import { test, expect } from '@fixtures';
import { PermissionsClient } from '@api/clients/permissions.client';
import { myPermissionsSchema, permissionListSchema } from '@schemas/permission.schema';

test.describe('GET /permissions', () => {
  test('deve listar o catálogo de permissões no formato modulo:acao', async ({ permissionsClient }) => {
    const response = await permissionsClient.list();

    expect(response.status).toBe(200);
    expect(response).toMatchContract(permissionListSchema);
    expect(response.data.length).toBeGreaterThan(0);
    for (const permission of response.data) {
      expect.soft(permission.slug).toMatch(/^[\w-]+:[\w-]+$/);
    }
  });

  test('o prefixo do slug deve ser igual ao módulo da permissão', {
    annotation: {
      type: 'bug',
      description: 'BUG-001: permissão "audit_logs:read" usa underscore, mas o módulo dela é "audit-logs"',
    },
  }, async ({ permissionsClient }) => {
    // Bug conhecido: o teste falha hoje e isso é o esperado. Quando corrigirem,
    // o Playwright acusa "passou inesperadamente" — aí é só remover esta linha.
    // Relatório: bugs/BUG-001-permissao-audit-logs-fora-do-padrao.md
    test.fail();

    const response = await permissionsClient.list();

    const divergent = response.data
      .filter((permission) => permission.slug.split(':')[0] !== permission.module)
      .map((permission) => `${permission.slug} (módulo: ${permission.module})`);
    expect(divergent).toEqual([]);
  });

  test('deve recusar requisição sem token', async ({ request }) => {
    const response = await new PermissionsClient(request).list();

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });
});

test.describe('GET /permissions/me', () => {
  test('deve retornar as permissões do usuário autenticado sem duplicidade @smoke', async ({ permissionsClient }) => {
    const response = await permissionsClient.me();

    expect(response.status).toBe(200);
    expect(response).toMatchContract(myPermissionsSchema);
    expect(response.data).toEqual(expect.arrayContaining(['users:read', 'clients:read']));
    expect(new Set(response.data).size).toBe(response.data.length);
  });

  test('administrador deve possuir todas as permissões do catálogo', {
    annotation: {
      type: 'regra',
      description: 'RN-PERM-001: o perfil Administrador possui todas as permissões do catálogo',
    },
  }, async ({ permissionsClient }) => {
    const catalog = await permissionsClient.list();
    const mine = await permissionsClient.me();

    const catalogSlugs = catalog.data.map((permission) => permission.slug).sort();
    expect([...mine.data].sort()).toEqual(catalogSlugs);
  });

  test('deve recusar requisição sem token', async ({ request }) => {
    const response = await new PermissionsClient(request).me();

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });
});
