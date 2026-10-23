import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { qaName } from '@factories/test-data';

test.describe('PATCH /clients/{id}', () => {
  test('deve atualizar o nome e persistir a alteração @smoke', async ({ clientsClient, createClient }) => {
    const client = await createClient();
    const newName = qaName('Nome Atualizado');

    const response = await clientsClient.update(client.id, { name: newName });

    expect(response.status).toBe(200);
    expect(response.data.name).toBe(newName);
    // Confirma que foi salvo de verdade, e não só devolvido na resposta
    const reloaded = await clientsClient.getById(client.id);
    expect(reloaded.data.name).toBe(newName);
  });

  test('não deve permitir alterar o tipo de pessoa', {
    annotation: { type: 'regra', description: 'RN-CLI-007: o tipo de pessoa (PF/PJ) não pode ser alterado' },
  }, async ({ clientsClient, createClient }) => {
    const client = await createClient();

    // @ts-expect-error -- personType não existe no contrato de atualização; enviamos de propósito
    const response = await clientsClient.update(client.id, { personType: 'PJ' });

    expect(response.status).toBe(400);
    expect(response.errorMessages).toContain('property personType should not exist');
  });

  test('não deve permitir remover todos os telefones', {
    annotation: {
      type: 'regra',
      description: 'RN-CLI-001: o cliente deve ter exatamente 1 telefone principal (não documentado no Swagger)',
    },
  }, async ({ clientsClient, createClient }) => {
    const client = await createClient();

    const response = await clientsClient.update(client.id, { phones: [] });

    expect(response.status).toBe(400);
    expect(response.errorMessage).toBe('Cliente deve ter pelo menos 1 telefone principal');
  });

  test('deve reativar um cliente desativado', {
    annotation: { type: 'regra', description: 'RN-CLI-009: cliente desativado pode ser reativado com active=true' },
  }, async ({ clientsClient, createClient }) => {
    const inactive = await createClient(undefined, { active: false });

    const response = await clientsClient.update(inactive.id, { active: true });

    expect(response.status).toBe(200);
    expect(response.data.active).toBe(true);
    const reloaded = await clientsClient.getById(inactive.id);
    expect(reloaded.status).toBe(200);
  });

  test('deve retornar 404 para cliente inexistente', async ({ clientsClient }) => {
    const response = await clientsClient.update(randomUUID(), { name: qaName('Inexistente') });

    expect(response.status).toBe(404);
  });
});
