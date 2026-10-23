import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { env } from '@config/env';

/**
 * ATENÇÃO: o POST /auth/login aceita só 5 tentativas por minuto (x-ratelimit-limit: 5).
 * Cada teste deste arquivo gasta 1 tentativa. Mantenha a quantidade de testes enxuta
 * e evite rodar este arquivo várias vezes seguidas em menos de 1 minuto.
 */
test.describe('POST /auth/login', () => {
  test('deve autenticar o admin com credenciais válidas @smoke', async ({ authClient }) => {
    // Act
    const response = await authClient.login({
      tenantId: env.TENANT_ID,
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    });

    // Assert
    expect(response.status).toBe(200);
    const { accessToken, expiresIn, user } = response.data;
    expect(accessToken).toMatch(/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/); // formato JWT: header.payload.assinatura
    expect(expiresIn).toBe('8h');
    expect(user.email).toBe(env.ADMIN_EMAIL);
    expect(user.tenantId).toBe(env.TENANT_ID);
  });

  test('não deve autenticar com senha incorreta', async ({ authClient }) => {
    // A senha errada tem 8+ caracteres de propósito: com menos, a API barraria na
    // validação de formato e o teste não chegaria a verificar as credenciais.
    const response = await authClient.login({
      tenantId: env.TENANT_ID,
      email: env.ADMIN_EMAIL,
      password: 'SenhaErrada123',
    });

    expect(response.status).toBe(400);
    expect(response.errorMessage).toBe('Credenciais inválidas');
  });

  test('não deve revelar se o tenant existe', {
    annotation: {
      type: 'regra',
      description: 'RN-AUTH-001: tenant inexistente retorna a mesma mensagem genérica de senha incorreta',
    },
  }, async ({ authClient }) => {
    const response = await authClient.login({
      tenantId: randomUUID(),
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.errorMessage).toBe('Credenciais inválidas');
  });

  test('deve listar todos os erros de validação quando o corpo vem vazio', async ({ authClient }) => {
    const response = await authClient.login({});

    expect(response.status).toBe(400);
    expect(response.errorMessage).toEqual(
      expect.arrayContaining([
        'O tenantId deve ser um UUID válido.',
        'E-mail inválido.',
        'A senha deve ter no mínimo 8 caracteres.',
      ]),
    );
  });
});
