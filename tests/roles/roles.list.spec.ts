import { test, expect } from '@fixtures';
import { RolesClient } from '@api/clients/roles.client';
import { roleListSchema } from '@schemas/role.schema';
import { decodeJwtPayload } from '@utils/jwt';

test.describe('GET /roles', () => {
  test('deve seguir o contrato da listagem', async ({ rolesClient }) => {
    const response = await rolesClient.list({ limit: 100 });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(roleListSchema);
  });

  test('deve listar os perfis do tenant com a paginação padrão @smoke', async ({ rolesClient }) => {
    // Act
    const response = await rolesClient.list();

    // Assert
    expect(response.status).toBe(200);
    const { items, total, page, limit } = response.data;
    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(items.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(items.length);
  });

  test('deve incluir o perfil do usuário autenticado', async ({ rolesClient, adminToken }) => {
    // Arrange: o perfil do admin está dentro do próprio token (campo roleId)
    const { roleId } = decodeJwtPayload(adminToken);

    // Act
    const response = await rolesClient.list({ limit: 100 });

    // Assert
    expect(response.status).toBe(200);
    expect(response.data.items.map((role) => role.id)).toContain(roleId);
  });

  test('deve respeitar o limite de itens por página', async ({ rolesClient }) => {
    const response = await rolesClient.list({ page: 1, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.data.items).toHaveLength(2);
    expect(response.data.limit).toBe(2);
  });

  test('deve retornar lista vazia para página além do total', async ({ rolesClient }) => {
    const response = await rolesClient.list({ page: 999 });

    expect(response.status).toBe(200);
    expect(response.data.items).toEqual([]);
    expect(response.data.page).toBe(999);
  });

  const invalidFilters = [
    { scenario: 'limit acima de 100', filters: { limit: 101 }, message: 'limit must not be greater than 100' },
    { scenario: 'página menor que 1', filters: { page: 0 }, message: 'page must not be less than 1' },
  ];

  for (const { scenario, filters, message } of invalidFilters) {
    test(`deve recusar ${scenario}`, async ({ rolesClient }) => {
      const response = await rolesClient.list(filters);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(message);
    });
  }

  test('deve exigir token', async ({ request }) => {
    const response = await new RolesClient(request).list();

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });
});
