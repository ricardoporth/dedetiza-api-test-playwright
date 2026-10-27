import { test, expect } from '@fixtures';
import { healthSchema } from '@schemas/health.schema';

test.describe('Health check', () => {
  test('deve informar que a API e suas dependências estão no ar @smoke', async ({ healthClient }) => {
    // Act
    const response = await healthClient.check();

    // Assert
    expect(response.status).toBe(200);
    expect(response).toMatchContract(healthSchema);
    expect(response.data.status).toBe('ok');
    expect(response.data.info?.database?.status).toBe('up');
    expect(response.data.info?.redis?.status).toBe('up');
  });
});
