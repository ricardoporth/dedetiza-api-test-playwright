import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { env } from '../config/env';
import { API_CALL_ANNOTATION, BUG_ANNOTATION, RULE_ANNOTATION, parseApiCall, type ApiCall } from './annotations';
import { buildCoverage, type TestRecord } from './coverage-model';
import { renderHtml } from './html';
import { extractOperations, loadOpenApi } from './openapi';

interface Store {
  tests: Record<string, TestRecord>;
}

/**
 * Reporter do Playwright que gera coverage/index.html ao final de cada execução.
 *
 * Os resultados ficam acumulados em coverage/data.json: rodar só um módulo atualiza
 * os testes daquele módulo sem apagar os demais. Para reconstruir do zero: npm run coverage:reset
 */
export default class CoverageReporter implements Reporter {
  private rootDir = process.cwd();
  private outputDir = path.join(this.rootDir, 'coverage');
  private store: Store = { tests: {} };
  private testsRan = 0;

  printsToStdio() {
    return false;
  }

  onBegin(config: FullConfig) {
    if (config.configFile) this.rootDir = path.dirname(config.configFile);
    this.outputDir = path.join(this.rootDir, 'coverage');
    this.store = this.loadStore();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.testsRan++;
    // Anotações declaradas no teste + as adicionadas durante a execução (chamadas do BaseClient)
    const annotations = [...test.annotations, ...result.annotations];
    const ofType = (type: string) =>
      [...new Set(annotations.filter((a) => a.type === type && a.description).map((a) => a.description!))];

    const testDir = test.parent.project()?.testDir ?? this.rootDir;
    const titlePath = test.titlePath();
    const fileIndex = titlePath.findIndex((part) => /\.(spec|test|setup)\.ts$/.test(part));

    this.store.tests[test.id] = {
      file: toPosix(path.relative(this.rootDir, test.location.file)),
      folder: toPosix(path.relative(testDir, test.location.file)).split('/')[0] ?? '',
      title: titlePath.slice(fileIndex + 1).join(' › '),
      outcome: test.outcome(),
      calls: uniqueCalls(ofType(API_CALL_ANNOTATION).map(parseApiCall)),
      rules: ofType(RULE_ANNOTATION),
      bugs: ofType(BUG_ANNOTATION),
      lastRun: new Date().toISOString(),
    };
  }

  async onEnd() {
    // Ex.: "playwright test --list" não executa nada — não há o que atualizar
    if (this.testsRan === 0) return;

    try {
      // Esquece testes de arquivos que foram apagados
      for (const [id, record] of Object.entries(this.store.tests)) {
        if (!fs.existsSync(path.join(this.rootDir, record.file))) delete this.store.tests[id];
      }
      fs.mkdirSync(this.outputDir, { recursive: true });
      fs.writeFileSync(this.dataFile, JSON.stringify(this.store, null, 2));

      const { document, fromCache } = await loadOpenApi(env.OPENAPI_URL, path.join(this.outputDir, 'openapi.json'));
      const operations = extractOperations(document, new URL(env.API_BASE_URL).pathname);
      const model = buildCoverage(operations, Object.values(this.store.tests), fromCache);

      const htmlFile = path.join(this.outputDir, 'index.html');
      fs.writeFileSync(htmlFile, renderHtml(model));

      const { coveredOperations, operations: total } = model.totals;
      console.log(
        `\n  Cobertura de rotas: ${coveredOperations}/${total} (${((coveredOperations / total) * 100).toFixed(1)}%)` +
          ` → ${toPosix(path.relative(process.cwd(), htmlFile))}`,
      );
    } catch (error) {
      // O relatório nunca deve derrubar a execução dos testes
      console.warn(`\n  [cobertura] Não foi possível gerar o relatório: ${error}`);
    }
  }

  private get dataFile() {
    return path.join(this.outputDir, 'data.json');
  }

  private loadStore(): Store {
    try {
      return JSON.parse(fs.readFileSync(this.dataFile, 'utf8')) as Store;
    } catch {
      return { tests: {} };
    }
  }
}

function uniqueCalls(calls: (ApiCall | undefined)[]): ApiCall[] {
  const seen = new Map<string, ApiCall>();
  for (const call of calls) {
    if (call) seen.set(`${call.method} ${call.path} ${call.status}`, call);
  }
  return [...seen.values()];
}

function toPosix(filePath: string) {
  return filePath.split(path.sep).join('/');
}
