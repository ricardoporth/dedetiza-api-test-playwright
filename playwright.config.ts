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

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // Gera coverage/index.html com a cobertura das rotas do Swagger
    ['./src/coverage/coverage-reporter.ts'],
    ...(isCI ? [['github'] as const] : []),
  ],

  use: {
    baseURL: env.API_BASE_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
    // Guarda request/response completos dos testes que falharam (abre com: npx playwright show-trace)
    trace: 'retain-on-failure',
  },

  projects: [
    // 1º: faz login uma vez e salva o token em .auth/admin.json
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // 2º: todos os testes, só depois que o setup passar
    { name: 'api', testMatch: /.*\.spec\.ts/, dependencies: ['setup'] },
  ],
});
