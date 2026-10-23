import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { ClientsClient } from '@api/clients/clients.client';
import type { ApiResponse } from '@api/api-response';
import { buildAddress, buildClientPF } from '@factories/client.factory';

/**
 * Todas as rotas do módulo exigem autenticação.
 * Sem token, a API deve responder 401 antes de olhar qualquer outra coisa —
 * por isso ids aleatórios bastam aqui.
 */
const protectedRoutes: [string, (client: ClientsClient) => Promise<ApiResponse>][] = [
  ['POST /clients', (client) => client.create(buildClientPF())],
  ['GET /clients', (client) => client.list()],
  ['GET /clients/{id}', (client) => client.getById(randomUUID())],
  ['PATCH /clients/{id}', (client) => client.update(randomUUID(), { name: 'x' })],
  ['DELETE /clients/{id}', (client) => client.deactivate(randomUUID())],
  ['POST /clients/{id}/addresses', (client) => client.addAddress(randomUUID(), buildAddress())],
  ['PATCH /clients/{id}/addresses/{addressId}', (client) => client.updateAddress(randomUUID(), randomUUID(), { label: 'x' })],
  ['DELETE /clients/{id}/addresses/{addressId}', (client) => client.removeAddress(randomUUID(), randomUUID())],
];

test.describe('Clientes — autenticação', () => {
  for (const [route, call] of protectedRoutes) {
    test(`${route} deve exigir token`, async ({ request }) => {
      const anonymous = new ClientsClient(request);

      const response = await call(anonymous);

      expect(response.status).toBe(401);
    });
  }
});
