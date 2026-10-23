import { test, expect } from '@playwright/test';

test.describe('Health check', () => {
  test('deve informar que a API e suas dependências estão no ar @smoke', async ({ request }) => {
    // Act
    const response = await request.get('health');

    // Assert
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.status).toBe('ok');
    expect(body.data.info.database.status).toBe('up');
    expect(body.data.info.redis.status).toBe('up');
  });
});
