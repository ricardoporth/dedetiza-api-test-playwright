import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/api-response';
import { ServiceTypesClient } from '@api/clients/service-types.client';
import { buildServiceType } from '@factories/service-type.factory';
import { tamperSignature } from '@utils/jwt';

/**
 * Todas as rotas do módulo exigem autenticação e permissão.
 * Sem token (ou sem permissão), a API deve barrar antes de olhar qualquer outra coisa —
 * por isso ids aleatórios bastam aqui.
 */
const routes: [string, (client: ServiceTypesClient) => Promise<ApiResponse>][] = [
  ['POST /service-types', (client) => client.create(buildServiceType())],
  ['GET /service-types', (client) => client.list()],
  ['GET /service-types/{id}', (client) => client.getById(randomUUID())],
  ['PATCH /service-types/{id}', (client) => client.update(randomUUID(), { name: 'x' })],
  ['DELETE /service-types/{id}', (client) => client.deactivate(randomUUID())],
];

test.describe('Tipos de serviço — 401 não autenticado', () => {
  for (const [route, call] of routes) {
    test(`${route} deve exigir token`, async ({ request }) => {
      const response = await call(new ServiceTypesClient(request));

      expect(response.status).toBe(401);
      expect(response).toMatchErrorContract();
    });
  }

  test('deve recusar token com assinatura adulterada', async ({ request, adminToken }) => {
    const response = await new ServiceTypesClient(request, tamperSignature(adminToken)).list();

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });
});

test.describe('Tipos de serviço — 403 sem permissão', () => {
  for (const [route, call] of routes) {
    test(`${route} deve recusar usuário sem permissão`, {
      annotation: { type: 'regra', description: 'RN-STP-013: todas as rotas de tipos de serviço exigem permissão do módulo (403)' },
    }, async ({ request, noPermissionToken, cleanup }) => {
      const withoutPermission = new ServiceTypesClient(request, noPermissionToken, cleanup);

      const response = await call(withoutPermission);

      expect(response.status).toBe(403);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Permissão insuficiente');
    });
  }

  test('o 403 não deve revelar se o registro existe', async ({ request, noPermissionToken, createServiceType }) => {
    // Mesma resposta para um id que existe e para um que não existe: sem permissão, nada é revelado
    const existing = await createServiceType();
    const withoutPermission = new ServiceTypesClient(request, noPermissionToken);

    const [forExisting, forMissing] = [
      await withoutPermission.getById(existing.id),
      await withoutPermission.getById(randomUUID()),
    ];

    expect(forExisting.status).toBe(403);
    expect(forMissing.status).toBe(403);
    expect(forExisting.errorMessage).toBe(forMissing.errorMessage);
  });
});
