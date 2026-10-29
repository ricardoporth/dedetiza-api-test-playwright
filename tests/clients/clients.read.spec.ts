import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { buildAddress, buildClientPF, buildClientPJ } from '@factories/client.factory';
import { clientListSchema, clientSchema } from '@schemas/client.schema';

test.describe('GET /clients/{id}', () => {
  test('deve detalhar o cliente com telefones e endereços @smoke', async ({ clientsClient, createClient }) => {
    const created = await createClient(buildClientPF({ addresses: [buildAddress()] }));

    const response = await clientsClient.getById(created.id);

    expect(response.status).toBe(200);
    expect(response).toMatchContract(clientSchema);
    expect(response.data).toMatchObject({
      id: created.id,
      name: created.name,
      personType: 'PF',
      pf: { cpf: created.pf?.cpf },
    });
    expect(response.data.phones).toHaveLength(1);
    expect(response.data.addresses).toHaveLength(1);
  });

  test('deve retornar 404 para cliente inexistente', async ({ clientsClient }) => {
    const response = await clientsClient.getById(randomUUID());

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Cliente não encontrado');
  });

  test('deve retornar 400 para id fora do formato UUID', async ({ clientsClient }) => {
    const response = await clientsClient.getById('id-invalido');

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Validation failed (uuid is expected)');
  });
});

test.describe('GET /clients', () => {
  test('deve listar clientes com os dados de paginação', async ({ clientsClient, createClient }) => {
    await createClient();

    const response = await clientsClient.list({ page: 1, limit: 5 });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(clientListSchema);
    const { items, total, page, limit } = response.data;
    expect(page).toBe(1);
    expect(limit).toBe(5);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThanOrEqual(items.length);
  });

  test('deve filtrar pelo documento (CPF)', async ({ clientsClient, createClient }) => {
    const created = await createClient();

    const response = await clientsClient.list({ document: created.pf!.cpf });

    expect(response.status).toBe(200);
    expect(response.data.items.map((client) => client.id)).toEqual([created.id]);
  });

  test('deve filtrar pelo nome', async ({ clientsClient, createClient }) => {
    const created = await createClient();

    const response = await clientsClient.list({ name: created.name });

    expect(response.status).toBe(200);
    expect(response.data.items.map((client) => client.id)).toContain(created.id);
  });

  test('deve filtrar pelo tipo de pessoa', async ({ clientsClient, createClient }) => {
    await createClient(buildClientPJ());

    const response = await clientsClient.list({ personType: 'PJ', limit: 20 });

    expect(response.status).toBe(200);
    expect(response.data.items.length).toBeGreaterThan(0);
    for (const client of response.data.items) {
      expect.soft(client.personType).toBe('PJ');
    }
  });

  test('deve limitar a 100 itens por página', {
    annotation: { type: 'regra', description: 'RN-CLI-011: a listagem aceita no máximo 100 itens por página' },
  }, async ({ clientsClient }) => {
    const response = await clientsClient.list({ limit: 101 });

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessages).toContain('limit must not be greater than 100');
  });

  test('deve recusar página menor que 1', async ({ clientsClient }) => {
    const response = await clientsClient.list({ page: 0 });

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessages).toContain('page must not be less than 1');
  });
});
