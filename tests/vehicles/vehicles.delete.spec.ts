import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { withoutCoverage } from '@api/base.client';
import { vehicleSchema } from '@schemas/vehicle.schema';

test.describe('DELETE /vehicles/{id}', () => {
  const softDeleteRule = {
    type: 'regra',
    description: 'RN-VEI-009: a exclusão é lógica (active=false): o veículo continua consultável e na listagem',
  };

  test('deve desativar o veículo (soft delete) @smoke', { annotation: softDeleteRule }, async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle();

    const response = await vehiclesClient.deactivate(vehicle.id);

    expect(response.status).toBe(200);
    expect(response).toMatchContract(vehicleSchema);
    expect(response.data).toMatchObject({ id: vehicle.id, plate: vehicle.plate, active: false });
  });

  test('veículo desativado continua consultável pelo id', { annotation: softDeleteRule }, async ({ vehiclesClient, createVehicle }) => {
    const vehicle = await createVehicle();
    await vehiclesClient.deactivate(vehicle.id);

    const reloaded = await withoutCoverage(() => vehiclesClient.getById(vehicle.id));

    expect(reloaded.status).toBe(200);
    expect(reloaded.data.active).toBe(false);
  });

  test('desativar duas vezes não é erro (operação idempotente)', {
    annotation: { type: 'regra', description: 'RN-VEI-010: desativar um veículo já desativado responde 200 (idempotente)' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const inactive = await createVehicle(undefined, { active: false });

    const response = await vehiclesClient.deactivate(inactive.id);

    expect(response.status).toBe(200);
    expect(response.data.active).toBe(false);
  });

  test('deve retornar 404 para veículo inexistente', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.deactivate(randomUUID());

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Veículo não encontrado');
  });

  test('deve retornar 400 para id fora do formato UUID', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.deactivate('abc');

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
  });
});
