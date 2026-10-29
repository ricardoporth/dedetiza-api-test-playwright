import { randomBytes } from 'node:crypto';
import { test as setup, expect } from '@fixtures';
import { env } from '@config/env';
import { withoutCoverage } from '@api/base.client';
import { NO_PERMISSION_SESSION_FILE, isSessionReusable, readSession, saveSession } from '@auth/session-store';
import { NO_PERMISSION_IDENTITY as identity } from '@auth/test-identities';
import { generateCpf } from '@utils/documents';

/**
 * Prepara a identidade "sem permissões", usada nos testes de 403.
 * Roda junto com o login do admin, antes de todos os testes (projeto "setup").
 *
 *  1. Sessão em cache ainda válida? Usa e termina.
 *  2. Garante que o perfil fixo existe (cria se não existir).
 *  3. Garante que o usuário fixo existe, ativo, nesse perfil, com uma senha nova.
 *  4. Faz login e salva a sessão em .auth/no-permission.json.
 */
setup('autenticar usuário sem permissões', async ({ authClient, rolesClient, usersClient }) => {
  setup.setTimeout(120_000);

  const cached = readSession(NO_PERMISSION_SESSION_FILE);
  if (cached && isSessionReusable(cached, { email: identity.email, tenantId: env.TENANT_ID })) {
    setup.info().annotations.push({ type: 'info', description: `Token reaproveitado do cache (válido até ${cached.expiresAt})` });
    return;
  }

  // Senha nova a cada provisionamento: nunca fica gravada em lugar nenhum além da sessão
  const password = `Qa#${randomBytes(9).toString('base64url')}`;

  // Preparação: não conta para a cobertura (não estamos testando roles nem users aqui)
  await withoutCoverage(async () => {
    const roles = await rolesClient.list({ limit: 100 });
    let role = roles.data.items.find((item) => item.name === identity.roleName);
    if (!role) {
      const created = await rolesClient.create({ name: identity.roleName, description: identity.roleDescription });
      expect(created.status, `Falha ao criar o perfil fixo: ${JSON.stringify(created.body)}`).toBe(201);
      role = created.data;
    }

    const users = await usersClient.list({ limit: 100 });
    const existing = users.data.items.find((user) => user.email === identity.email);
    const saved = existing
      ? await usersClient.update(existing.id, { roleId: role.id, password, active: true })
      : await usersClient.create({
          roleId: role.id,
          name: identity.userName,
          email: identity.email,
          cpf: generateCpf(),
          password,
          confirmPassword: password,
        });
    expect([200, 201], `Falha ao preparar o usuário fixo: ${JSON.stringify(saved.body)}`).toContain(saved.status);
  });

  const login = await withoutCoverage(() =>
    authClient.loginRespectingRateLimit({ tenantId: env.TENANT_ID, email: identity.email, password }),
  );
  expect(login.status, `Login do usuário sem permissões falhou: ${JSON.stringify(login.body)}`).toBe(200);
  saveSession(NO_PERMISSION_SESSION_FILE, login.data);
});
