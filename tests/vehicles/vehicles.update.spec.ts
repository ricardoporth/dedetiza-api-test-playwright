import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { withoutCoverage } from '@api/base.client';
import { buildFullVehicle, lunchTimeAsReturned } from '@factories/vehicle.factory';
import { qaName } from '@factories/test-data';
import { vehicleSchema } from '@schemas/vehicle.schema';

test.describe('PATCH /vehicles/{id} — 200 atualizado', () => {
  test('deve atualizar o modelo e persistir a alteração @smoke', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle();
    const model = qaName('Fiat Fiorino');

    const response = await vehiclesClient.update(vehicle.id, { model });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(vehicleSchema);
    expect(response.data.model).toBe(model);
    // Confirma que foi salvo de verdade, e não só devolvido na resposta
    const reloaded = await withoutCoverage(() => vehiclesClient.getById(vehicle.id));
    expect(reloaded.data.model).toBe(model);
  });

  test('deve alterar só o campo enviado e manter os demais', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle(buildFullVehicle());

    const response = await vehiclesClient.update(vehicle.id, { year: 2020 });

    expect(response.status).toBe(200);
    expect(omitUpdatedAt(response.data)).toEqual({ ...omitUpdatedAt(vehicle), year: 2020 });
    expect(Date.parse(response.data.updatedAt)).toBeGreaterThanOrEqual(Date.parse(vehicle.updatedAt));
  });

  test('corpo vazio não altera nada', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle(buildFullVehicle());

    const response = await vehiclesClient.update(vehicle.id, {});

    expect(response.status).toBe(200);
    expect(omitUpdatedAt(response.data)).toEqual(omitUpdatedAt(vehicle));
  });

  test('deve trocar e depois remover o horário de almoço', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle(buildFullVehicle());

    const changed = await vehiclesClient.update(vehicle.id, { defaultLunchStart: '13:15', defaultLunchEnd: '14:00' });
    const removed = await vehiclesClient.update(vehicle.id, { defaultLunchStart: null, defaultLunchEnd: null });

    expect(changed.status).toBe(200);
    expect([changed.data.defaultLunchStart, changed.data.defaultLunchEnd]).toEqual([lunchTimeAsReturned('13:15'), lunchTimeAsReturned('14:00')]);
    expect(removed.status).toBe(200);
    expect([removed.data.defaultLunchStart, removed.data.defaultLunchEnd]).toEqual([null, null]);
  });

  test('deve aceitar a própria placa (não conflita consigo mesmo)', async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle();

    const response = await vehiclesClient.update(vehicle.id, { plate: vehicle.plate });

    expect(response.status).toBe(200);
  });

  test('deve reativar um veículo desativado', {
    annotation: { type: 'regra', description: 'RN-VEI-008: veículo desativado pode ser reativado com active=true' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const inactive = await createVehicle(undefined, { active: false });

    const response = await vehiclesClient.update(inactive.id, { active: true });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(vehicleSchema);
    expect(response.data.active).toBe(true);
  });
});

test.describe('PATCH /vehicles/{id} — erros', () => {
  test('não deve permitir trocar para a placa de outro veículo', {
    annotation: { type: 'regra', description: 'RN-VEI-001: a placa é única no tenant (409)' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const [vehicle, other] = [await createVehicle(), await createVehicle()];

    const response = await vehiclesClient.update(vehicle.id, { plate: other.plate });

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Placa já cadastrada neste tenant');
  });

  test('não deve deixar o almoço pela metade', {
    annotation: { type: 'regra', description: 'RN-VEI-005: o almoço padrão tem início E fim, e o início vem antes do fim' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle(buildFullVehicle());

    const response = await vehiclesClient.update(vehicle.id, { defaultLunchEnd: null });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(response.errorMessage).toBe('O intervalo padrão de almoço deve ter início e fim válidos');
  });

  const invalidCases = [
    { scenario: 'ano 2101', fields: { year: 2101 }, expected: 'year must not be greater than 2100' },
    { scenario: 'placa em formato inválido', fields: { plate: 'abc-123' }, expected: 'Placa deve estar no formato Mercosul (ABC1D23) ou antigo (ABC1234)' },
    { scenario: 'campo "isAdmin"', fields: { isAdmin: true }, expected: 'property isAdmin should not exist' },
  ];

  for (const { scenario, fields, expected } of invalidCases) {
    test(`deve recusar ${scenario}`, async ({ vehiclesClient, createVehicle }) => {
      const vehicle = await createVehicle();

      const response = await vehiclesClient.update(vehicle.id, fields);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(expected);
    });
  }

  test('deve retornar 404 para veículo inexistente', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.update(randomUUID(), { model: qaName('Inexistente') });

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
  });

  test('deve recusar modelo só com espaços', {
    annotation: { type: 'bug', description: 'BUG-014: modelo do veículo só com espaços ("   ") é aceito' },
  }, async ({ vehiclesClient, createVehicle }) => {
    // Bug conhecido: hoje a API responde 200. Relatório: bugs/BUG-014-modelo-de-veiculo-so-com-espacos.md
    test.fail();
    const vehicle = await createVehicle();

    const response = await vehiclesClient.update(vehicle.id, { model: '   ' });

    expect(response.status).toBe(400);
  });

  /** O Swagger marca todos os campos do UpdateVehicleDto como nullable. null em campo obrigatório deve dar 400. */
  for (const field of ['plate', 'model', 'year', 'active'] as const) {
    test(`"${field}": null não deve causar erro 500`, {
      annotation: { type: 'bug', description: 'BUG-011: null em campos documentados como nullable causa erro 500' },
    }, async ({ vehiclesClient, createVehicle }) => {
      // Bug conhecido: hoje a API responde 500. Relatório: bugs/BUG-011-null-em-campos-nullable-causa-500.md
      test.fail();
      const vehicle = await createVehicle();

      const response = await vehiclesClient.update(vehicle.id, { [field]: null });

      expect(response.status, 'a API não pode quebrar (5xx) com null em campo nullable').toBeLessThan(500);
    });
  }
});

/** Para comparar dois estados do mesmo veículo ignorando o momento da última alteração. */
function omitUpdatedAt<T extends { updatedAt: string }>(entity: T): Omit<T, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...rest } = entity;
  return rest;
}
