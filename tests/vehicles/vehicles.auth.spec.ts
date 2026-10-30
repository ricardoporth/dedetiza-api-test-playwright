import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/api-response';
import { VehiclesClient } from '@api/clients/vehicles.client';
import { buildVehicle } from '@factories/vehicle.factory';

/**
 * Heurística de autorização: TODA rota do módulo, com e sem permissão.
 * Sem token → 401. Com token de um usuário sem permissões → 403.
 * O id do veículo é aleatório: a API deve barrar o acesso antes de procurar o registro.
 */
const routes: [string, (client: VehiclesClient) => Promise<ApiResponse>][] = [
  ['POST /vehicles', (client) => client.create(buildVehicle())],
  ['GET /vehicles', (client) => client.list()],
  ['GET /vehicles/{id}', (client) => client.getById(randomUUID())],
  ['PATCH /vehicles/{id}', (client) => client.update(randomUUID(), { model: '[QA-AUTO] x' })],
  ['DELETE /vehicles/{id}', (client) => client.deactivate(randomUUID())],
];

test.describe('Veículos — 401 sem token', () => {
  for (const [route, call] of routes) {
    test(`${route} deve exigir token`, async ({ request }) => {
      const response = await call(new VehiclesClient(request));

      expect(response.status).toBe(401);
      expect(response).toMatchErrorContract();
    });
  }
});

test.describe('Veículos — 403 sem permissão', () => {
  for (const [route, call] of routes) {
    test(`${route} deve recusar usuário sem permissão`, {
      annotation: { type: 'regra', description: 'RN-VEI-011: todas as rotas de veículos exigem permissão (vehicles:read/create/update/delete)' },
    }, async ({ request, noPermissionToken, cleanup }) => {
      // Passa o cleanup: se a API aceitasse um POST por engano, o veículo seria desativado no fim
      const withoutPermission = new VehiclesClient(request, noPermissionToken, cleanup);

      const response = await call(withoutPermission);

      expect(response.status).toBe(403);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Permissão insuficiente');
    });
  }
});
