import type { ApiCall } from './annotations';
import type { Operation } from './openapi';

/** O que o reporter guarda de cada teste executado. */
export interface TestRecord {
  /** Arquivo relativo à raiz do projeto. Ex.: "tests/auth/login.spec.ts" */
  file: string;
  /** Pasta do teste dentro de tests/ — por convenção, igual à tag do módulo no Swagger */
  folder: string;
  title: string;
  outcome: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  calls: ApiCall[];
  rules: string[];
  bugs: string[];
  lastRun: string;
}

export interface TestRef {
  title: string;
  file: string;
  passing: boolean;
}

export interface OperationCoverage extends Operation {
  /** Status documentados que algum teste aprovado recebeu */
  coveredStatuses: number[];
  /** Status recebidos por testes aprovados mas que não estão no Swagger */
  undocumentedStatuses: number[];
  tests: TestRef[];
  covered: boolean;
}

export type ModuleState = 'nao-iniciado' | 'em-andamento' | 'completo';

export interface ModuleCoverage {
  name: string;
  state: ModuleState;
  operations: OperationCoverage[];
  coveredOperations: number;
  rules: { text: string; test: string }[];
  bugs: { text: string; test: string }[];
  failingTests: TestRef[];
}

export interface CoverageModel {
  generatedAt: Date;
  specFromCache: boolean;
  modules: ModuleCoverage[];
  /** Chamadas feitas pelos testes para rotas que não existem no Swagger */
  unknownCalls: { method: string; path: string; tests: string[] }[];
  totals: {
    operations: number;
    coveredOperations: number;
    documentedStatuses: number;
    coveredStatuses: number;
    modules: number;
    startedModules: number;
    rules: number;
    bugs: number;
    tests: number;
    failingTests: number;
  };
}

const isPassing = (test: TestRecord) => test.outcome === 'expected' || test.outcome === 'flaky';
const operationKey = (method: string, path: string) => `${method} ${path}`;

export function buildCoverage(
  operations: Operation[],
  tests: TestRecord[],
  specFromCache: boolean,
): CoverageModel {
  const ranTests = tests.filter((test) => test.outcome !== 'skipped');
  const callsByOperation = new Map<string, { test: TestRecord; status: number }[]>();
  for (const test of ranTests) {
    for (const call of test.calls) {
      const key = operationKey(call.method, call.path);
      const list = callsByOperation.get(key) ?? [];
      list.push({ test, status: call.status });
      callsByOperation.set(key, list);
    }
  }

  const moduleNames = [...new Set(operations.map((operation) => operation.module))];
  const modules: ModuleCoverage[] = moduleNames.map((name) => {
    const moduleOperations = operations
      .filter((operation) => operation.module === name)
      .map((operation) => coverOperation(operation, callsByOperation.get(operationKey(operation.method, operation.path)) ?? []));

    const moduleTests = ranTests.filter((test) => test.folder.toLowerCase() === name.toLowerCase());
    const coveredOperations = moduleOperations.filter((operation) => operation.covered).length;

    return {
      name,
      operations: moduleOperations,
      coveredOperations,
      state:
        coveredOperations === 0 ? 'nao-iniciado' : coveredOperations === moduleOperations.length ? 'completo' : 'em-andamento',
      rules: unique(moduleTests.flatMap((test) => test.rules.map((text) => ({ text, test: test.title })))),
      bugs: unique(moduleTests.flatMap((test) => test.bugs.map((text) => ({ text, test: test.title })))),
      failingTests: moduleTests.filter((test) => !isPassing(test)).map(toRef),
    };
  });

  const knownKeys = new Set(operations.map((operation) => operationKey(operation.method, operation.path)));
  const unknownCalls = [...callsByOperation.entries()]
    .filter(([key]) => !knownKeys.has(key))
    .map(([key, calls]) => {
      const [method = '', path = ''] = key.split(' ');
      return { method, path, tests: [...new Set(calls.map((call) => call.test.title))] };
    });

  const allOperations = modules.flatMap((module) => module.operations);
  return {
    generatedAt: new Date(),
    specFromCache,
    modules,
    unknownCalls,
    totals: {
      operations: allOperations.length,
      coveredOperations: allOperations.filter((operation) => operation.covered).length,
      documentedStatuses: allOperations.reduce((sum, operation) => sum + operation.documentedStatuses.length, 0),
      coveredStatuses: allOperations.reduce((sum, operation) => sum + operation.coveredStatuses.length, 0),
      modules: modules.length,
      startedModules: modules.filter((module) => module.state !== 'nao-iniciado').length,
      rules: modules.reduce((sum, module) => sum + module.rules.length, 0),
      bugs: modules.reduce((sum, module) => sum + module.bugs.length, 0),
      tests: ranTests.length,
      failingTests: ranTests.filter((test) => !isPassing(test)).length,
    },
  };
}

function coverOperation(operation: Operation, calls: { test: TestRecord; status: number }[]): OperationCoverage {
  const passingStatuses = new Set(calls.filter((call) => isPassing(call.test)).map((call) => call.status));
  const tests = new Map<string, TestRef>();
  for (const { test } of calls) tests.set(test.title, toRef(test));

  return {
    ...operation,
    coveredStatuses: operation.documentedStatuses.filter((status) => passingStatuses.has(status)),
    undocumentedStatuses: [...passingStatuses]
      .filter((status) => !operation.documentedStatuses.includes(status))
      .sort((a, b) => a - b),
    tests: [...tests.values()],
    covered: passingStatuses.size > 0,
  };
}

function toRef(test: TestRecord): TestRef {
  return { title: test.title, file: test.file, passing: isPassing(test) };
}

function unique<T extends { text: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.text) && seen.add(item.text));
}
