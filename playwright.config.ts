import { defineConfig } from '@playwright/test';
import { env } from './src/config/env';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,

  // Local: falha na hora, para você investigar. CI: tenta de novo para filtrar instabilidade de rede.
  retries: isCI ? 2 : 0,

  // Tempo máximo de cada teste (inclui todas as requisições dele)
  timeout: 30_000,

  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: env.API_BASE_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
    // Guarda request/response completos dos testes que falharam (abre com: npx playwright show-trace)
    trace: 'retain-on-failure',
  },
});
