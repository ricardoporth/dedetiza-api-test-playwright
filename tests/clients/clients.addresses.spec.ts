import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { buildAddress, buildClientPF } from '@factories/client.factory';
import { addressSchema } from '@schemas/client.schema';

test.describe('POST /clients/{id}/addresses', () => {
  test('deve adicionar endereço ao cliente @smoke', async ({ clientsClient, createClient }) => {
    const client = await createClient();
    const address = buildAddress({ label: 'Trabalho' });

    const response = await clientsClient.addAddress(client.id, address);

    expect(response.status).toBe(201);
    expect(response).toMatchContract(addressSchema);
    expect(response.data).toMatchObject({
      clientId: client.id,
      label: 'Trabalho',
      zipcode: address.zipcode,
      street: address.street,
      number: address.number,
      state: address.state,
    });
  });

  test('deve calcular latitude e longitude do endereço automaticamente', {
    annotation: {
      type: 'regra',
      description: 'RN-CLI-010: endereços são geocodificados automaticamente (latitude/longitude) ao salvar',
    },
  }, async ({ clientsClient, createClient }) => {
    const client = await createClient();

    const response = await clientsClient.addAddress(client.id, buildAddress());

    expect(response.status).toBe(201);
    expect(response.data.latitude).toEqual(expect.any(Number));
    expect(response.data.longitude).toEqual(expect.any(Number));
    expect(response.data.geocodedAt).toBeTruthy();
  });

  test('deve recusar CEP com tamanho diferente de 8', async ({ clientsClient, createClient }) => {
    const client = await createClient();

    const response = await clientsClient.addAddress(client.id, buildAddress({ zipcode: '123' }));

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessages).toContain('CEP deve ter exatamente 8 digitos');
  });

  test('deve recusar CEP com letras ou símbolos', {
    annotation: {
      type: 'bug',
      description:
        'BUG-002: a API só valida o TAMANHO do CEP (8 caracteres) — aceita e salva "ABCDEFGH", "0100-100" e "01001 00"',
    },
  }, async ({ clientsClient, createClient }) => {
    // Bug conhecido: hoje a API responde 201. Quando corrigirem, remova esta linha.
    test.fail();
    const client = await createClient();

    const response = await clientsClient.addAddress(client.id, buildAddress({ zipcode: 'ABCDEFGH' }));

    expect(response.status).toBe(400);
  });

  test('deve retornar 404 para cliente inexistente', async ({ clientsClient }) => {
    const response = await clientsClient.addAddress(randomUUID(), buildAddress());

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
  });
});

test.describe('PATCH /clients/{id}/addresses/{addressId}', () => {
  test('deve atualizar o endereço', async ({ clientsClient, createClient }) => {
    const client = await createClient(buildClientPF({ addresses: [buildAddress()] }));
    const addressId = client.addresses[0]!.id;

    const response = await clientsClient.updateAddress(client.id, addressId, { complement: 'Sala 42' });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(addressSchema);
    expect(response.data.complement).toBe('Sala 42');
  });

  test('deve retornar 404 para endereço inexistente', async ({ clientsClient, createClient }) => {
    const client = await createClient();

    const response = await clientsClient.updateAddress(client.id, randomUUID(), { complement: 'Sala 42' });

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
  });
});

test.describe('DELETE /clients/{id}/addresses/{addressId}', () => {
  test('deve remover o endereço do cliente', async ({ clientsClient, createClient }) => {
    const client = await createClient(buildClientPF({ addresses: [buildAddress()] }));
    const addressId = client.addresses[0]!.id;

    const response = await clientsClient.removeAddress(client.id, addressId);

    expect(response.status).toBe(200);
    // A remoção de endereço responde só { statusCode, message }, sem "data"
    expect(response).toMatchContract();
    const reloaded = await clientsClient.getById(client.id);
    expect(reloaded.data.addresses.map((address) => address.id)).not.toContain(addressId);
  });

  test('deve retornar 404 para endereço inexistente', async ({ clientsClient, createClient }) => {
    const client = await createClient();

    const response = await clientsClient.removeAddress(client.id, randomUUID());

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
  });
});
