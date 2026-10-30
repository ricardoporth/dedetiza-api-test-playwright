import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fakerPT_BR as faker } from '@faker-js/faker';
import { test, expect } from '@fixtures';
import { env } from '@config/env';
import type { ApiResponse } from '@api/api-response';
import { withoutCoverage } from '@api/base.client';
import { VehiclesClient } from '@api/clients/vehicles.client';
import { loadOpenApi } from '../../src/coverage/openapi';
import { buildFullVehicle, buildVehicle, lunchTimeAsReturned } from '@factories/vehicle.factory';
import { QA_PREFIX } from '@factories/test-data';
import { vehicleListSchema, vehicleSchema } from '@schemas/vehicle.schema';
import {
  errorHeuristics,
  paginationHeuristics,
  responseHeaderHeuristics,
  vehicleHeuristics,
} from '@utils/contract-heuristics';
import { decodeJwtPayload } from '@utils/jwt';

/**
 * Contrato do módulo vehicles em três camadas:
 *  1. Estrutura — schema Zod estrito (campo a mais ou a menos falha) em todas as rotas
 *  2. Swagger — o que a API devolve bate com o que está documentado (detecta "drift")
 *  3. Heurísticas — regras entre campos, entre respostas e de robustez que o schema não expressa
 *     (ver src/utils/contract-heuristics.ts)
 */

test.describe('Veículos — contrato estrutural entre rotas', () => {
  test('POST, GET por id, listagem, PATCH e DELETE devolvem o mesmo registro', async ({ vehiclesClient }) => {
    const created = await vehiclesClient.create(buildFullVehicle());
    expect(created.status).toBe(201);

    const byId = await vehiclesClient.getById(created.data.id);
    const listed = await vehiclesClient.list({ plate: created.data.plate });
    const patched = await vehiclesClient.update(created.data.id, {});
    const deleted = await vehiclesClient.deactivate(created.data.id);

    for (const response of [created, byId, patched, deleted]) expect(response).toMatchContract(vehicleSchema);
    expect(listed).toMatchContract(vehicleListSchema);
    expect(byId.data).toEqual(created.data);
    expect(listed.data.items).toEqual([created.data]);
    expect({ ...patched.data, updatedAt: created.data.updatedAt }).toEqual(created.data);
    expect({ ...deleted.data, updatedAt: created.data.updatedAt }).toEqual({ ...created.data, active: false });
  });

  test('todos os veículos do tenant seguem o contrato e as heurísticas', async ({ vehiclesClient, adminToken }) => {
    // Dados reais e variados (cadastrados pela tela, antigos) pegam o que a massa de teste não pega
    const { tenantId } = decodeJwtPayload(adminToken);
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const response = await vehiclesClient.list({ limit: 100, page });
      expect(response).toMatchContract(vehicleListSchema);
      all.push(...response.data.items);
      if (page * 100 >= response.data.total) break;
    }

    expect(all.length).toBeGreaterThan(0);
    // O contrato (schema) vale para todos. As heurísticas de plausibilidade valem só para dados reais:
    // a massa [QA-AUTO] tem valores-limite de propósito (ex.: ano 2100, aceito pelo contrato).
    const realVehicles = all.filter((vehicle) => !vehicle.model.startsWith(QA_PREFIX));
    expect(realVehicles.flatMap((vehicle) => vehicleHeuristics(vehicle, { tenantId }))).toEqual([]);
  });
});

test.describe('Veículos — contrato x Swagger', () => {
  async function swagger() {
    const { document } = await loadOpenApi(env.OPENAPI_URL, path.resolve('coverage/openapi.json'));
    return document as unknown as {
      components: { schemas: Record<string, { required?: string[]; properties: Record<string, unknown> }> };
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
  }

  test('os campos do veículo batem com o VehicleResponseDto do Swagger', async ({ vehiclesClient }) => {
    const response = await withoutCoverage(() => vehiclesClient.create(buildFullVehicle()));
    const documented = (await swagger()).components.schemas.VehicleResponseDto;
    expect(documented, 'VehicleResponseDto sumiu do Swagger').toBeDefined();

    const actual = Object.keys(response.data).sort();
    const missing = (documented!.required ?? []).filter((field) => !actual.includes(field));
    const undocumented = actual.filter((field) => !(field in documented!.properties));

    expect({ missing, undocumented }, 'campos obrigatórios ausentes / campos fora do Swagger').toEqual({ missing: [], undocumented: [] });
  });

  test('os campos do erro batem com o ErrorResponseDto do Swagger', async ({ vehiclesClient }) => {
    const response = await withoutCoverage(() => vehiclesClient.getById(randomUUID()));
    const documented = (await swagger()).components.schemas.ErrorResponseDto;

    const actual = Object.keys(response.body as object).sort();
    expect(actual).toEqual(Object.keys(documented!.properties).sort());
  });

  test('os status HTTP que a API usa estão documentados no Swagger', async () => {
    // Status observados nos testes deste módulo (sem os 500 dos bugs conhecidos).
    const observed: Record<string, Record<string, number[]>> = {
      '/api/v1/vehicles': { post: [201, 400, 401, 403, 409], get: [200, 400, 401, 403] },
      '/api/v1/vehicles/{id}': {
        get: [200, 400, 401, 403, 404],
        patch: [200, 400, 401, 403, 404, 409],
        delete: [200, 400, 401, 403, 404],
      },
    };
    const { paths } = await swagger();

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

test.describe('Veículos — heurística de ida e volta (o que entra é o que sai)', () => {
  /**
   * Horário de almoço é uma coluna "time" serializada como data em 1970-01-01 UTC.
   * Clássico de bug: o servidor aplicar fuso (-3h) e "12:00" voltar como "15:00".
   * Horários perto da meia-noite pegam também erro de virada de dia.
   */
  const lunchPairs: [string, string][] = [
    ['00:00', '00:30'],
    ['02:59', '03:00'],
    ['12:00', '13:00'],
    ['20:59', '21:00'],
    ['23:00', '23:59'],
  ];

  for (const [start, end] of lunchPairs) {
    test(`almoço ${start}–${end} volta exatamente igual (sem deslocamento de fuso)`, async ({ vehiclesClient }) => {
      const created = await vehiclesClient.create(buildVehicle({ defaultLunchStart: start, defaultLunchEnd: end }));
      const reloaded = await withoutCoverage(() => vehiclesClient.getById(created.data.id));

      expect(created.status).toBe(201);
      for (const data of [created.data, reloaded.data]) {
        expect([data.defaultLunchStart, data.defaultLunchEnd]).toEqual([lunchTimeAsReturned(start), lunchTimeAsReturned(end)]);
      }
    });
  }

  test('placa, modelo e ano voltam exatamente como enviados (sem trim, caixa ou arredondamento)', async ({ vehiclesClient }) => {
    const payload = buildVehicle({ model: '[QA-AUTO] Fiat Strada Working 1.4 Flex — Ção', year: 2009 });

    const created = await vehiclesClient.create(payload);

    expect(created.status).toBe(201);
    expect({ plate: created.data.plate, model: created.data.model, year: created.data.year }).toEqual({
      plate: payload.plate,
      model: payload.model,
      year: payload.year,
    });
  });
});

test.describe('Veículos — heurísticas de ordem e paginação', () => {
  /** Massa controlada: 3 placas com o mesmo prefixo de 3 letras, que só elas têm. */
  async function createThreeWithSamePrefix(createVehicle: (payload?: ReturnType<typeof buildVehicle>) => Promise<unknown>) {
    const prefix = faker.string.alpha({ length: 3, casing: 'upper' });
    for (let i = 0; i < 3; i++) {
      await createVehicle(buildVehicle({ plate: `${prefix}${faker.string.numeric(1)}${faker.string.alpha({ length: 1, casing: 'upper' })}${faker.string.numeric(2)}` }));
    }
    return prefix;
  }

  test('a paginação não repete nem perde veículos', async ({ vehiclesClient, createVehicle }) => {
    const prefix = await createThreeWithSamePrefix(createVehicle);

    const page1 = await vehiclesClient.list({ plate: prefix, limit: 2, page: 1 });
    const page2 = await vehiclesClient.list({ plate: prefix, limit: 2, page: 2 });

    expect(paginationHeuristics(page1.data, { page: 1, limit: 2 })).toEqual([]);
    expect(paginationHeuristics(page2.data, { page: 2, limit: 2 })).toEqual([]);
    expect([page1.data.total, page2.data.total]).toEqual([3, 3]);
    const ids = [...page1.data.items, ...page2.data.items].map((vehicle) => vehicle.id);
    expect(new Set(ids).size).toBe(3);
  });

  test('a mesma consulta repetida devolve a mesma ordem', async ({ vehiclesClient, createVehicle }) => {
    const prefix = await createThreeWithSamePrefix(createVehicle);

    const first = await vehiclesClient.list({ plate: prefix });
    const second = await vehiclesClient.list({ plate: prefix });

    expect(second.data.items.map((vehicle) => vehicle.id)).toEqual(first.data.items.map((vehicle) => vehicle.id));
  });
});

test.describe('Veículos — heurísticas de erro e de headers', () => {
  /** Uma chamada de cada tipo de erro do módulo: todas devem seguir as mesmas regras. */
  const errorCalls: [string, (admin: VehiclesClient, anonymous: VehiclesClient, noPermission: VehiclesClient) => Promise<ApiResponse>][] = [
    ['400 validação do corpo', (admin) => admin.create({ plate: '' })],
    ['400 corpo que não é JSON', (admin) => admin.create('plate=ABC1234' as unknown as Record<string, unknown>)],
    ['400 id inválido', (admin) => admin.getById('abc')],
    ['400 query inválida', (admin) => admin.list({ limit: 101 })],
    ['400 intervalo de disponibilidade', (admin) => admin.list({ availableStart: '2026-11-02T18:00:00Z', availableEnd: '2026-11-02T08:00:00Z' })],
    ['401 sem token', (_, anonymous) => anonymous.list()],
    ['403 sem permissão', (_, __, noPermission) => noPermission.list()],
    ['404 inexistente', (admin) => admin.getById(randomUUID())],
    ['409 intervalo de almoço', (admin) => admin.create(buildVehicle({ defaultLunchStart: '14:00', defaultLunchEnd: '13:00' }))],
  ];

  for (const [scenario, call] of errorCalls) {
    test(`erro ${scenario}: formato, path, timestamp, sem vazar detalhes internos`, async ({ vehiclesClient, request, noPermissionToken }) => {
      const response = await call(vehiclesClient, new VehiclesClient(request), new VehiclesClient(request, noPermissionToken));

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response).toMatchErrorContract();
      expect(errorHeuristics(response)).toEqual([]);
      expect(responseHeaderHeuristics(response)).toEqual([]);
    });
  }

  test('erro 409 de placa duplicada segue as mesmas regras', async ({ vehiclesClient, createVehicle }) => {
    const existing = await createVehicle();

    const response = await vehiclesClient.create(buildVehicle({ plate: existing.plate }));

    expect(response.status).toBe(409);
    expect(errorHeuristics(response)).toEqual([]);
  });

  test('respostas de sucesso têm os headers de formato e segurança', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle();

    const responses = [await vehiclesClient.getById(vehicle.id), await vehiclesClient.list({ limit: 1 })];

    for (const response of responses) expect(responseHeaderHeuristics(response)).toEqual([]);
  });

  test('tempo de resposta razoável (abaixo de 3 s) @heuristica', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle();
    const timings: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await vehiclesClient.getById(vehicle.id);
      timings.push(Date.now() - start);
    }

    test.info().annotations.push({ type: 'tempos (ms)', description: timings.join(', ') });
    expect(Math.max(...timings)).toBeLessThan(3_000);
  });
});

test.describe('Veículos — heurística de robustez (fronteiras e tipos: 4xx, nunca 500)', () => {
  /**
   * Valores extremos, tipos errados e null em cada campo. A API pode aceitar (2xx) ou
   * recusar (4xx) — o que ela nunca pode é quebrar (5xx). Quando aceita, segue o contrato.
   */
  const boundaryCases: { scenario: string; fields: Record<string, unknown>; bug?: string }[] = [
    { scenario: 'active null', fields: { active: null }, bug: 'BUG-011' },
    { scenario: 'almoço null/null', fields: { defaultLunchStart: null, defaultLunchEnd: null } },
    { scenario: 'year 2.147.483.648 (além de um int)', fields: { year: 2_147_483_648 } },
    { scenario: 'year 1e20', fields: { year: 1e20 } },
    { scenario: 'year negativo', fields: { year: -2023 } },
    { scenario: 'model com 100.000 caracteres', fields: { model: 'm'.repeat(100_000) } },
    { scenario: 'plate com 10.000 caracteres', fields: { plate: 'A'.repeat(10_000) } },
    { scenario: 'model como objeto', fields: { model: { nome: 'Strada' } } },
    { scenario: 'model como lista', fields: { model: ['Strada'] } },
    { scenario: 'model com SQL injection', fields: { model: "[QA-AUTO] '); DROP TABLE vehicles;--" } },
    { scenario: 'model com emoji e acentos', fields: { model: '[QA-AUTO] Caminhão 🚚 Ção' } },
    { scenario: 'horário de almoço numérico', fields: { defaultLunchStart: 1200, defaultLunchEnd: 1300 } },
  ];

  for (const { scenario, fields, bug } of boundaryCases) {
    const details = bug ? { annotation: { type: 'bug', description: `${bug}: a API responde 500 para "${scenario}"` } } : {};
    test(`POST com ${scenario} não deve causar 500`, details, async ({ vehiclesClient }) => {
      // Bug conhecido: hoje a API responde 500. Relatório: bugs/BUG-011-null-em-campos-nullable-causa-500.md
      if (bug) test.fail();

      const response = await vehiclesClient.create({ ...buildVehicle(), ...fields });

      expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBeLessThan(500);
      if (response.ok) expect(response).toMatchContract(vehicleSchema);
      else expect(response).toMatchErrorContract();
    });
  }

  test('corpo como lista em vez de objeto não deve causar 500', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.create([buildVehicle()] as unknown as Record<string, unknown>);

    expect(response.status).toBeLessThan(500);
  });
});
