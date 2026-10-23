import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { UsersClient } from '@api/clients/users.client';
import { tamperSignature } from '@utils/jwt';

test.describe('GET /users/me', () => {
  test('deve retornar os dados do usuário autenticado @smoke', async ({ usersClient }) => {
    const response = await usersClient.me();

    expect(response.status).toBe(200);
    expect(response.data.email).toBe(env.ADMIN_EMAIL);
    expect(response.data.active).toBe(true);
  });

  test('não deve expor senha ou hash do usuário', {
    annotation: { type: 'regra', description: 'RN-USR-001: dados do usuário nunca expõem senha ou hash' },
  }, async ({ usersClient }) => {
    const response = await usersClient.me();

    expect(response.status).toBe(200);
    const sensitiveFields = Object.keys(response.data).filter((key) => /password|senha|hash|secret/i.test(key));
    expect(sensitiveFields).toEqual([]);
  });

  test('deve recusar requisição sem token', async ({ request }) => {
    const anonymous = new UsersClient(request);

    const response = await anonymous.me();

    expect(response.status).toBe(401);
    expect(response.errorMessage).toBe('Unauthorized');
  });

  test('deve recusar token com assinatura adulterada', {
    annotation: {
      type: 'regra',
      description: 'RN-USR-002: token JWT com assinatura alterada é recusado com 401',
    },
  }, async ({ request, adminToken }) => {
    const withTamperedToken = new UsersClient(request, tamperSignature(adminToken));

    const response = await withTamperedToken.me();

    expect(response.status).toBe(401);
  });
});
