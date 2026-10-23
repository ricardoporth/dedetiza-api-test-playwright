import { test as base } from '@playwright/test';
import { withoutCoverage } from '@api/base.client';
import { ADMIN_SESSION_FILE, readSession } from '@auth/session-store';
import { Cleanup } from '@utils/cleanup';

/**
 * Camada 1 — infraestrutura usada por todas as outras fixtures:
 *  - adminToken: token do admin salvo pelo projeto "setup"
 *  - cleanup: remove ao final do teste tudo o que ele criou
 */
export interface CoreTestFixtures {
  cleanup: Cleanup;
}

export interface CoreWorkerFixtures {
  /** Token do admin salvo pelo projeto "setup" — lido uma vez por worker */
  adminToken: string;
}

export const test = base.extend<CoreTestFixtures, CoreWorkerFixtures>({
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

  // Depende de "request" só para garantir a ordem: a conexão HTTP é encerrada DEPOIS da limpeza
  cleanup: async ({ request: _request }, use, testInfo) => {
    const cleanup = new Cleanup();
    await use(cleanup);

    const failures = await withoutCoverage(() => cleanup.runAll());
    for (const failure of failures) {
      testInfo.annotations.push({ type: 'limpeza-falhou', description: failure });
      console.warn(`  [limpeza] ${testInfo.title} → ${failure}`);
    }
  },
});
