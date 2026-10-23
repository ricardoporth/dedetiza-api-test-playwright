import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';

test.describe('DELETE /clients/{id}', () => {
  const softDeleteRule = {
    type: 'regra',
    description:
      'RN-CLI-008: a exclusão é lógica (active=false): o cliente some do detalhe (404) mas continua na listagem',
  };

  test('deve desativar o cliente (soft delete) @smoke', { annotation: softDeleteRule }, async ({ clientsClient, createClient }) => {
    const client = await createClient();

    const response = await clientsClient.deactivate(client.id);

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(client.id);
    expect(response.data.active).toBe(false);
  });

  test('cliente desativado não deve ser encontrado no detalhe', { annotation: softDeleteRule }, async ({ clientsClient, createClient }) => {
    const client = await createClient(undefined, { active: false });

    const response = await clientsClient.getById(client.id);

    // Comportamento atual, a confirmar com o time: o detalhe responde 404,
    // mas a listagem continua mostrando o cliente (teste abaixo) e o PATCH consegue reativá-lo.
    expect(response.status).toBe(404);
  });

  test('cliente desativado deve continuar na listagem com active=false', { annotation: softDeleteRule }, async ({ clientsClient, createClient }) => {
    const client = await createClient(undefined, { active: false });

    const response = await clientsClient.list({ document: client.pf!.cpf, active: false });

    expect(response.status).toBe(200);
    expect(response.data.items).toEqual([expect.objectContaining({ id: client.id, active: false })]);
  });

  test('deve retornar 404 ao desativar um cliente já desativado', async ({ clientsClient, createClient }) => {
    const client = await createClient(undefined, { active: false });

    const response = await clientsClient.deactivate(client.id);

    expect(response.status).toBe(404);
  });

  test('deve retornar 404 para cliente inexistente', async ({ clientsClient }) => {
    const response = await clientsClient.deactivate(randomUUID());

    expect(response.status).toBe(404);
  });
});
