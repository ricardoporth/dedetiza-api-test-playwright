import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { buildFullVehicle, buildVehicle } from '@factories/vehicle.factory';
import { vehicleListSchema, vehicleSchema } from '@schemas/vehicle.schema';
import { paginationHeuristics } from '@utils/contract-heuristics';

test.describe('GET /vehicles/{id}', () => {
  test('deve retornar o veículo pelo id @smoke', async ({ vehiclesClient, createVehicle }) => {
    const created = await createVehicle(buildFullVehicle());

    const response = await vehiclesClient.getById(created.id);

    expect(response.status).toBe(200);
    expect(response).toMatchContract(vehicleSchema);
    expect(response.data).toEqual(created);
  });

  test('deve aceitar o id em letras maiúsculas', async ({ vehiclesClient, createVehicle }) => {
    const created = await createVehicle();

    const response = await vehiclesClient.getById(created.id.toUpperCase());

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(created.id);
  });

  test('deve retornar 404 para veículo inexistente', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.getById(randomUUID());

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Veículo não encontrado');
  });

  const malformedIds = ['abc', '123', 'null', ' ', "1' OR '1'='1", 'a'.repeat(5000)];

  for (const id of malformedIds) {
    test(`deve retornar 400 (nunca 500) para id malformado "${id.slice(0, 20)}"`, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.getById(id);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Validation failed (uuid is expected)');
    });
  }
});

test.describe('GET /vehicles — listagem e paginação', () => {
  test('deve listar com a paginação padrão (page 1, limit 20)', async ({ vehiclesClient, createVehicle }) => {
    await createVehicle();

    const response = await vehiclesClient.list();

    expect(response.status).toBe(200);
    expect(response).toMatchContract(vehicleListSchema);
    expect(paginationHeuristics(response.data, { page: 1, limit: 20 })).toEqual([]);
  });

  test('deve respeitar o limite de itens por página', async ({ vehiclesClient, createVehicle }) => {
    await createVehicle();
    await createVehicle();

    const response = await vehiclesClient.list({ page: 1, limit: 1 });

    expect(response.status).toBe(200);
    expect(paginationHeuristics(response.data, { page: 1, limit: 1 })).toEqual([]);
    expect(response.data.items).toHaveLength(1);
  });

  test('deve retornar lista vazia para página além do total', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.list({ page: 9999 });

    expect(response.status).toBe(200);
    expect(response.data.items).toEqual([]);
  });

  const invalidQueries = [
    { scenario: 'limit acima de 100', query: { limit: 101 }, expected: 'limit must not be greater than 100' },
    { scenario: 'página menor que 1', query: { page: 0 }, expected: 'page must not be less than 1' },
    { scenario: 'parâmetro desconhecido', query: { foo: 'bar' }, expected: 'property foo should not exist' },
  ];

  for (const { scenario, query, expected } of invalidQueries) {
    test(`deve recusar ${scenario}`, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.list(query);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(expected);
    });
  }
});

test.describe('GET /vehicles — filtro por placa', () => {
  test('deve encontrar o veículo por parte da placa', async ({ vehiclesClient, createVehicle }) => {
    const created = await createVehicle();

    const response = await vehiclesClient.list({ plate: created.plate.slice(1, 6), limit: 100 });

    expect(response.status).toBe(200);
    expect(response.data.items.map((vehicle) => vehicle.id)).toContain(created.id);
    for (const vehicle of response.data.items) expect.soft(vehicle.plate).toContain(created.plate.slice(1, 6));
  });

  test('a busca por placa não diferencia maiúsculas', {
    annotation: { type: 'regra', description: 'RN-VEI-006: o filtro de placa é parcial e não diferencia maiúsculas' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const created = await createVehicle();

    const response = await vehiclesClient.list({ plate: created.plate.toLowerCase() });

    expect(response.status).toBe(200);
    expect(response.data.items.map((vehicle) => vehicle.id)).toEqual([created.id]);
  });

  for (const wildcard of ['%', '_']) {
    test(`"${wildcard}" no filtro de placa deve ser tratado como texto, não como curinga`, {
      annotation: { type: 'bug', description: 'BUG-013: o filtro trata "_" e "%" como curingas do SQL (LIKE sem escape)' },
    }, async ({ vehiclesClient }) => {
      // Bug conhecido: hoje devolve todos os veículos. Relatório: bugs/BUG-013-filtro-trata-curingas-do-sql.md
      test.fail();

      const response = await vehiclesClient.list({ plate: wildcard });

      // Nenhuma placa válida contém "%" ou "_"
      expect(response.status).toBe(200);
      expect(response.data.total).toBe(0);
    });
  }
});

test.describe('GET /vehicles — filtro por situação (active)', () => {
  test('active=true deve trazer só veículos ativos', async ({ vehiclesClient, createVehicle }) => {
    await createVehicle(undefined, { active: false });

    const response = await vehiclesClient.list({ active: true, limit: 100 });

    expect(response.status).toBe(200);
    expect(response.data.items.filter((vehicle) => !vehicle.active).map((vehicle) => vehicle.plate)).toEqual([]);
  });

  test('active=false deve trazer só veículos inativos', {
    annotation: { type: 'bug', description: 'BUG-015: o filtro active=false devolve veículos ATIVOS (e active=abc é aceito)' },
  }, async ({ vehiclesClient, createVehicle }) => {
    // Bug conhecido. Relatório: bugs/BUG-015-filtro-active-false-devolve-ativos.md
    test.fail();
    const inactive = await createVehicle(undefined, { active: false });

    const response = await vehiclesClient.list({ plate: inactive.plate, active: false });

    expect(response.status).toBe(200);
    expect(response.data.items.map((vehicle) => vehicle.id)).toEqual([inactive.id]);
  });

  test('active com valor que não é booleano deve ser recusado', {
    annotation: { type: 'bug', description: 'BUG-015: o filtro active=false devolve veículos ATIVOS (e active=abc é aceito)' },
  }, async ({ vehiclesClient }) => {
    // Bug conhecido: hoje responde 200. Relatório: bugs/BUG-015-filtro-active-false-devolve-ativos.md
    test.fail();

    const response = await vehiclesClient.list({ active: 'abc' });

    expect(response.status).toBe(400);
  });

  test('sem o filtro, a listagem traz ativos e inativos', async ({ vehiclesClient, createVehicle }) => {
    const inactive = await createVehicle(undefined, { active: false });

    const response = await vehiclesClient.list({ plate: inactive.plate });

    expect(response.status).toBe(200);
    expect(response.data.items).toEqual([expect.objectContaining({ id: inactive.id, active: false })]);
  });
});

test.describe('GET /vehicles — filtro de disponibilidade', () => {
  test('deve aceitar um intervalo válido em ISO 8601', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.list({
      availableStart: '2026-11-02T08:00:00.000Z',
      availableEnd: '2026-11-02T18:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(vehicleListSchema);
  });

  const invalidIntervals = [
    {
      scenario: 'fim antes do início',
      query: { availableStart: '2026-11-02T18:00:00.000Z', availableEnd: '2026-11-02T08:00:00.000Z' },
      expected: 'availableEnd deve ser posterior a availableStart',
    },
    {
      scenario: 'só o início',
      query: { availableStart: '2026-11-02T08:00:00.000Z' },
      expected: 'availableStart e availableEnd devem ser informados juntos',
    },
    {
      scenario: 'datas fora do formato ISO 8601',
      query: { availableStart: 'abc', availableEnd: 'def' },
      expected: 'availableStart must be a valid ISO 8601 date string',
    },
  ];

  for (const { scenario, query, expected } of invalidIntervals) {
    test(`deve recusar intervalo com ${scenario}`, {
      annotation: { type: 'regra', description: 'RN-VEI-007: o filtro de disponibilidade exige início e fim em ISO 8601, com fim depois do início' },
    }, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.list(query);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(expected);
    });
  }
});
