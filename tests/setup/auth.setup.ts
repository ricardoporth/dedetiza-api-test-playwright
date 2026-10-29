import { test as setup, expect } from '@fixtures';
import { env } from '@config/env';
import { ADMIN_SESSION_FILE, isSessionReusable, readSession, saveSession } from '@auth/session-store';

/**
 * Roda UMA vez, antes de todos os testes (projeto "setup" no playwright.config.ts).
 * Reaproveita o token salvo enquanto ele for válido — o login tem limite de 5 tentativas por minuto.
 */
setup('autenticar admin', async ({ authClient }) => {
  const cached = readSession(ADMIN_SESSION_FILE);
  if (cached && isSessionReusable(cached, { email: env.ADMIN_EMAIL, tenantId: env.TENANT_ID })) {
    setup.info().annotations.push({
      type: 'info',
      description: `Token reaproveitado do cache (válido até ${cached.expiresAt})`,
    });
    return;
  }

  // Se o limite de login estiver estourado (429), o client espera e tenta de novo sozinho
  const response = await authClient.login({
    tenantId: env.TENANT_ID,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });

  expect(response.status, 'Login do admin falhou — confira TENANT_ID, ADMIN_EMAIL e ADMIN_PASSWORD no .env').toBe(200);
  saveSession(ADMIN_SESSION_FILE, response.data);
});
