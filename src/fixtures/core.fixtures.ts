import { test as base } from '@playwright/test';
import { withoutCoverage } from '@api/base.client';
import { ADMIN_SESSION_FILE, NO_PERMISSION_SESSION_FILE, readSession } from '@auth/session-store';
import { Cleanup } from '@utils/cleanup';

/**
 * Camada 1 — infraestrutura usada por todas as outras fixtures:
 *  - adminToken: token do admin salvo pelo projeto "setup"
 *  - noPermissionToken: token do usuário SEM permissões (para testar 403)
 *  - cleanup: remove ao final do teste tudo o que ele criou
 */
export interface CoreTestFixtures {
  cleanup: Cleanup;
}

export interface CoreWorkerFixtures {
  /** Token do admin salvo pelo projeto "setup" — lido uma vez por worker */
  adminToken: string;
  /** Token do usuário sem nenhuma permissão, salvo pelo projeto "identities" */
  noPermissionToken: string;
}

function readTokenOrFail(file: string, who: string): string {
  const session = readSession(file);
  if (!session) {
    throw new Error(
      `Token do ${who} não encontrado em ${file}. Os projetos de setup fazem o login antes dos testes — ` +
        'rode com "npx playwright test" (sem --no-deps).',
    );
  }
  return session.accessToken;
}

export const test = base.extend<CoreTestFixtures, CoreWorkerFixtures>({
  adminToken: [
    // eslint-disable-next-line no-empty-pattern -- o Playwright exige o primeiro parâmetro desestruturado
    async ({}, use) => {
      await use(readTokenOrFail(ADMIN_SESSION_FILE, 'admin'));
    },
    { scope: 'worker' },
  ],

  noPermissionToken: [
    // eslint-disable-next-line no-empty-pattern -- o Playwright exige o primeiro parâmetro desestruturado
    async ({}, use) => {
      await use(readTokenOrFail(NO_PERMISSION_SESSION_FILE, 'usuário sem permissões'));
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
