import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { env } from '@config/env';
import type { ApiResponse } from '@api/api-response';
import { withoutCoverage } from '@api/base.client';
import { ServiceTypesClient } from '@api/clients/service-types.client';
import { loadOpenApi } from '../../src/coverage/openapi';
import { buildFullServiceType, buildServiceType } from '@factories/service-type.factory';
import { serviceTypeListSchema, serviceTypeSchema } from '@schemas/service-type.schema';
import {
  errorHeuristics,
  paginationHeuristics,
  responseHeaderHeuristics,
  serviceTypeHeuristics,
} from '@utils/contract-heuristics';
import { decodeJwtPayload } from '@utils/jwt';

/**
 * Contrato do módulo service-types em três camadas:
 *  1. Estrutura — schema Zod estrito (campo a mais ou a menos falha) em todas as rotas
 *  2. Swagger — o que a API devolve bate com o que está documentado (detecta "drift")
 *  3. Heurísticas — regras entre campos, entre respostas e de robustez que o schema não expressa
 *     (ver src/utils/contract-heuristics.ts)
 */

test.describe('Tipos de serviço — contrato estrutural entre rotas', () => {
  test('POST, GET por id, listagem e PATCH devolvem o mesmo registro', async ({ serviceTypesClient, createMaterial }) => {
    const material = await createMaterial();
    const created = await serviceTypesClient.create(
      buildFullServiceType({ suggestedMaterials: [{ materialId: material.id, quantity: 7.25 }] }),
    );
    expect(created.status).toBe(201);

    const byId = await serviceTypesClient.getById(created.data.id);
    const listed = await serviceTypesClient.list({ name: created.data.name, status: 'all' });
    const patched = await serviceTypesClient.update(created.data.id, {});

    for (const response of [created, byId, patched]) expect(response).toMatchContract(serviceTypeSchema);
    expect(listed).toMatchContract(serviceTypeListSchema);
    expect(byId.data).toEqual(created.data);
    expect(listed.data.items).toEqual([created.data]);
    expect({ ...patched.data, updatedAt: created.data.updatedAt }).toEqual(created.data);
  });

  test('todos os tipos de serviço do tenant seguem o contrato e as heurísticas', async ({ serviceTypesClient, adminToken }) => {
    // Dados reais e variados (cadastrados pela tela, migrados, antigos) pegam o que a massa de teste não pega
    const { tenantId } = decodeJwtPayload(adminToken);
    const all = [];
    for (let page = 1; page <= 5; page++) {
      const response = await serviceTypesClient.list({ status: 'all', limit: 100, page });
      expect(response).toMatchContract(serviceTypeListSchema);
      all.push(...response.data.items);
      if (page * 100 >= response.data.total) break;
    }

    expect(all.length).toBeGreaterThan(0);
    expect(all.flatMap((serviceType) => serviceTypeHeuristics(serviceType, { tenantId }))).toEqual([]);
  });
});

test.describe('Tipos de serviço — contrato x Swagger', () => {
  /** Swagger atualizado (ou a última cópia, se a documentação estiver fora do ar). */
  async function swaggerSchemas() {
    const { document } = await loadOpenApi(env.OPENAPI_URL, path.resolve('coverage/openapi.json'));
    const doc = document as unknown as {
      components: { schemas: Record<string, { required?: string[]; properties: Record<string, unknown> }> };
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    return doc;
  }

  const responseObjects: [string, (data: Awaited<ReturnType<ServiceTypesClient['create']>>['data']) => object][] = [
    ['ServiceTypeResponseDto', (data) => data],
    ['ServiceTypeSuggestedMaterialResponseDto', (data) => data.suggestedMaterials[0]!],
    ['MaterialResponseDto', (data) => data.suggestedMaterials[0]!.material],
  ];

  for (const [schemaName, pick] of responseObjects) {
    test(`os campos de ${schemaName} batem com o Swagger`, async ({ serviceTypesClient, createMaterial }) => {
      const material = await createMaterial();
      const response = await withoutCoverage(() =>
        serviceTypesClient.create(buildServiceType({ suggestedMaterials: [{ materialId: material.id, quantity: 1 }] })),
      );
      const documented = (await swaggerSchemas()).components.schemas[schemaName];
      expect(documented, `${schemaName} sumiu do Swagger`).toBeDefined();

      const actual = Object.keys(pick(response.data)).sort();
      const missing = (documented!.required ?? []).filter((field) => !actual.includes(field));
      const undocumented = actual.filter((field) => !(field in documented!.properties));

      expect({ missing, undocumented }, 'campos obrigatórios ausentes / campos fora do Swagger').toEqual({
        missing: [],
        undocumented: [],
      });
    });
  }

  test('os status HTTP que a API usa estão documentados no Swagger', async () => {
    // Status observados nos testes deste módulo. Status sem documentação = cliente da API sem saber tratar.
    const observed: Record<string, Record<string, number[]>> = {
      '/api/v1/service-types': { post: [201, 400, 401, 403, 404, 409], get: [200, 400, 401, 403] },
      '/api/v1/service-types/{id}': {
        get: [200, 400, 401, 403, 404],
        patch: [200, 400, 401, 403, 404, 409],
        delete: [200, 400, 401, 403, 404],
      },
    };
    const { paths } = await swaggerSchemas();

    const undocumented = Object.entries(observed).flatMap(([route, methods]) =>
      Object.entries(methods).flatMap(([method, statuses]) =>
        statuses
          .filter((status) => !(String(status) in (paths[route]?.[method]?.responses ?? {})))
          .map((status) => `${method.toUpperCase()} ${route} → ${status}`),
      ),
    );
    expect(undocumented).toEqual([]);
  });
});

test.describe('Tipos de serviço — heurísticas de ordem e paginação', () => {
  test('a listagem é ordenada pelo nome e a paginação não repete nem perde itens', async ({ serviceTypesClient, createServiceType }) => {
    // Massa controlada: só os 3 tipos deste teste casam com o filtro
    const token = `ordem-${randomUUID().slice(0, 8)}`;
    for (const letter of ['C', 'A', 'B']) await createServiceType(buildServiceType({ name: `[QA-AUTO] ${token} ${letter}` }));

    const page1 = await serviceTypesClient.list({ name: token, limit: 2, page: 1 });
    const page2 = await serviceTypesClient.list({ name: token, limit: 2, page: 2 });

    expect(paginationHeuristics(page1.data, { page: 1, limit: 2 })).toEqual([]);
    expect(paginationHeuristics(page2.data, { page: 2, limit: 2 })).toEqual([]);
    expect([page1.data.total, page2.data.total]).toEqual([3, 3]);
    expect([...page1.data.items, ...page2.data.items].map((item) => item.name.at(-1))).toEqual(['A', 'B', 'C']);
  });

  test('a mesma consulta repetida devolve a mesma ordem', async ({ serviceTypesClient }) => {
    const [first, second] = [
      await serviceTypesClient.list({ status: 'all', limit: 50 }),
      await serviceTypesClient.list({ status: 'all', limit: 50 }),
    ];
    // Outros testes criam registros em paralelo: compara só os ids presentes nas duas respostas
    const common = (ids: string[], other: string[]) => ids.filter((id) => other.includes(id));
    const ids1 = first.data.items.map((item) => item.id);
    const ids2 = second.data.items.map((item) => item.id);

    expect(common(ids1, ids2)).toEqual(common(ids2, ids1));
  });
});

test.describe('Tipos de serviço — heurísticas de erro e de headers', () => {
  /** Uma chamada de cada tipo de erro do módulo: todas devem seguir as mesmas regras. */
  const errorCalls: [string, (client: ServiceTypesClient, anonymous: ServiceTypesClient) => Promise<ApiResponse>][] = [
    ['400 validação do corpo', (client) => client.create({ name: '' })],
    ['400 corpo que não é JSON', (client) => client.create('name=x' as unknown as Record<string, unknown>)],
    ['400 id inválido', (client) => client.getById('abc')],
    ['400 query inválida', (client) => client.list({ limit: 101, status: 'x' })],
    ['401 sem token', (_, anonymous) => anonymous.list()],
    ['404 inexistente', (client) => client.getById(randomUUID())],
    ['404 material inexistente', (client) => client.create(buildServiceType({ suggestedMaterials: [{ materialId: randomUUID(), quantity: 1 }] }))],
  ];

  for (const [scenario, call] of errorCalls) {
    test(`erro ${scenario}: formato, path, timestamp, sem vazar detalhes internos`, async ({ serviceTypesClient, request }) => {
      const response = await call(serviceTypesClient, new ServiceTypesClient(request));

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response).toMatchErrorContract();
      expect(errorHeuristics(response)).toEqual([]);
      expect(responseHeaderHeuristics(response)).toEqual([]);
    });
  }

  test('erro 409 de duplicidade segue as mesmas regras', async ({ serviceTypesClient, createServiceType }) => {
    const existing = await createServiceType();

    const response = await serviceTypesClient.create({ name: existing.name });

    expect(response.status).toBe(409);
    expect(errorHeuristics(response)).toEqual([]);
  });

  test('respostas de sucesso têm os headers de formato e segurança', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();

    const responses = [await serviceTypesClient.getById(created.id), await serviceTypesClient.list({ limit: 1 })];

    for (const response of responses) expect(responseHeaderHeuristics(response)).toEqual([]);
  });

  test('tempo de resposta razoável (abaixo de 3 s) @heuristica', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();
    const timings: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await serviceTypesClient.getById(created.id);
      timings.push(Date.now() - start);
    }

    test.info().annotations.push({ type: 'tempos (ms)', description: timings.join(', ') });
    expect(Math.max(...timings)).toBeLessThan(3_000);
  });
});

test.describe('Tipos de serviço — heurística de robustez (fronteiras do Swagger: 4xx, nunca 500)', () => {
  /**
   * Para cada restrição documentada no Swagger, valores no limite e logo além dele, tipos errados e null.
   * A API pode aceitar (2xx) ou recusar (4xx) — o que ela nunca pode é quebrar (5xx).
   * Quando aceita, a resposta tem que seguir o contrato.
   */
  const boundaryCases: { scenario: string; fields: Record<string, unknown>; bug?: string }[] = [
    { scenario: 'name null', fields: { name: null } },
    { scenario: 'name lista', fields: { name: ['a'] } },
    { scenario: 'internalCode número', fields: { internalCode: 123 } },
    { scenario: 'description com 100.000 caracteres', fields: { description: 'x'.repeat(100_000) } },
    { scenario: 'serviceGuaranteeMonths 2.147.483.647 (máximo de um int)', fields: { serviceGuaranteeMonths: 2_147_483_647 } },
    { scenario: 'serviceGuaranteeMonths 2.147.483.648', fields: { serviceGuaranteeMonths: 2_147_483_648 }, bug: 'BUG-010' },
    { scenario: 'documentationGuaranteeMonths 2.147.483.648', fields: { documentationGuaranteeMonths: 2_147_483_648 }, bug: 'BUG-010' },
    { scenario: 'serviceGuaranteeMonths 1e20', fields: { serviceGuaranteeMonths: 1e20 }, bug: 'BUG-010' },
    { scenario: 'status null', fields: { status: null }, bug: 'BUG-011' },
    { scenario: 'active null', fields: { active: null }, bug: 'BUG-011' },
    { scenario: 'requiresCertificate null', fields: { requiresCertificate: null }, bug: 'BUG-011' },
    { scenario: 'active como texto "true"', fields: { active: 'true' } },
    { scenario: 'active como número 1', fields: { active: 1 } },
    { scenario: 'suggestedMaterials null', fields: { suggestedMaterials: null } },
    { scenario: 'quantidade 999.999.999,999 (máximo do decimal)', fields: { suggestedMaterials: 'MAX_QTY' } },
    { scenario: 'quantidade 1.000.000.000', fields: { suggestedMaterials: 'OVER_QTY' }, bug: 'BUG-010' },
  ];

  for (const { scenario, fields, bug } of boundaryCases) {
    const details = bug ? { annotation: { type: 'bug', description: `${bug}: a API responde 500 para "${scenario}"` } } : {};
    test(`POST com ${scenario} não deve causar 500`, details, async ({ serviceTypesClient, createMaterial }) => {
      // Bug conhecido: hoje a API responde 500. Relatórios: bugs/BUG-010-*.md e bugs/BUG-011-*.md
      if (bug) test.fail();
      const payload: Record<string, unknown> = { ...buildServiceType(), ...fields };
      if (fields.suggestedMaterials === 'MAX_QTY' || fields.suggestedMaterials === 'OVER_QTY') {
        const material = await createMaterial();
        payload.suggestedMaterials = [
          { materialId: material.id, quantity: fields.suggestedMaterials === 'MAX_QTY' ? 999_999_999.999 : 1_000_000_000 },
        ];
      }

      const response = await serviceTypesClient.create(payload);

      expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBeLessThan(500);
      if (response.ok) expect(response).toMatchContract(serviceTypeSchema);
      else expect(response).toMatchErrorContract();
    });
  }
});
