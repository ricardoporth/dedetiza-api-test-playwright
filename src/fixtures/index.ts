import { test as base } from '@playwright/test';
import { AuthClient } from '@api/clients/auth.client';
import { HealthClient } from '@api/clients/health.client';
import { PermissionsClient } from '@api/clients/permissions.client';
import { UsersClient } from '@api/clients/users.client';
import { ADMIN_SESSION_FILE, readSession } from '@auth/session-store';

/**
 * Clients disponíveis como parâmetro em qualquer teste:
 *   test('...', async ({ usersClient }) => { ... })
 *
 * O Playwright só cria o que o teste pedir. Clients de rotas protegidas já vêm
 * com o token do admin; para testar 401, crie o client sem token: new UsersClient(request)
 */
interface TestFixtures {
  healthClient: HealthClient;
  authClient: AuthClient;
  usersClient: UsersClient;
  permissionsClient: PermissionsClient;
}

interface WorkerFixtures {
  /** Token do admin salvo pelo projeto "setup" — lido uma vez por worker */
  adminToken: string;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  adminToken: [
    // eslint-disable-next-line no-empty-pattern -- o Playwright exige o primeiro parâmetro desestruturado
    async ({}, use) => {
      const session = readSession(ADMIN_SESSION_FILE);
      if (!session) {
        throw new Error(
          'Token do admin não encontrado em .auth/admin.json. O projeto "setup" faz o login antes dos testes — ' +
            'rode com "npx playwright test" (sem --no-deps).',
        );
      }
      await use(session.accessToken);
    },
    { scope: 'worker' },
  ],

  // Rotas públicas
  healthClient: async ({ request }, use) => {
    await use(new HealthClient(request));
  },
  authClient: async ({ request }, use) => {
    await use(new AuthClient(request));
  },

  // Rotas protegidas — já autenticadas como admin
  usersClient: async ({ request, adminToken }, use) => {
    await use(new UsersClient(request, adminToken));
  },
  permissionsClient: async ({ request, adminToken }, use) => {
    await use(new PermissionsClient(request, adminToken));
  },
});

export { expect } from '@playwright/test';
