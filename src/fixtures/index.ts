import { test as base } from '@playwright/test';
import { AuthClient } from '@api/clients/auth.client';
import { HealthClient } from '@api/clients/health.client';

/**
 * Clients disponíveis como parâmetro em qualquer teste:
 *   test('...', async ({ authClient }) => { ... })
 *
 * O Playwright só cria o client que o teste pedir.
 */
interface ClientFixtures {
  healthClient: HealthClient;
  authClient: AuthClient;
}

export const test = base.extend<ClientFixtures>({
  healthClient: async ({ request }, use) => {
    await use(new HealthClient(request));
  },
  authClient: async ({ request }, use) => {
    await use(new AuthClient(request));
  },
});

export { expect } from '@playwright/test';
