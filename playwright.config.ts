import { defineConfig } from '@playwright/test';

/**
 * Configuração mínima da Fase 1.
 * Na Fase 2 entram: baseURL vinda do .env, headers padrão,
 * projeto de setup (login) e retries diferentes para CI.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
});
