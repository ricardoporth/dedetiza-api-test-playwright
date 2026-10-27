import { test, expect } from '@fixtures';
import type { CreateClientRequest } from '@api/clients/clients.client';
import { buildAddress, buildClientPF, buildClientPJ, buildPhone, buildPj } from '@factories/client.factory';
import { clientSchema } from '@schemas/client.schema';
import { formatCpf, generateCpf, withWrongCheckDigit } from '@utils/documents';

test.describe('POST /clients — cadastro com sucesso', () => {
  test('deve cadastrar cliente pessoa física @smoke', async ({ clientsClient }) => {
    // Arrange
    const payload = buildClientPF();

    // Act
    const response = await clientsClient.create(payload);

    // Assert
    expect(response.status).toBe(201);
    expect(response).toMatchContract(clientSchema);
    const client = response.data;
    expect(client.id).toBeTruthy();
    expect(client.personType).toBe('PF');
    expect(client.name).toBe(payload.name);
    expect(client.email).toBe(payload.email);
    expect(client.active).toBe(true);
    expect(client.pf?.cpf).toBe(payload.pf?.cpf);
    expect(client.pj).toBeNull();
    expect(client.primaryPhone?.number).toBe(payload.phones?.[0]?.number);
  });

  test('deve cadastrar cliente pessoa jurídica', async ({ clientsClient }) => {
    const payload = buildClientPJ();

    const response = await clientsClient.create(payload);

    expect(response.status).toBe(201);
    expect(response).toMatchContract(clientSchema);
    expect(response.data.personType).toBe('PJ');
    expect(response.data.pf).toBeNull();
    expect(response.data.pj).toMatchObject({
      cnpj: payload.pj?.cnpj,
      legalName: payload.pj?.legalName,
      tradeName: payload.pj?.tradeName,
    });
  });

  test('deve cadastrar cliente já com endereço', async ({ clientsClient }) => {
    const address = buildAddress();

    const response = await clientsClient.create(buildClientPF({ addresses: [address] }));

    expect(response.status).toBe(201);
    expect(response).toMatchContract(clientSchema);
    expect(response.data.addresses).toHaveLength(1);
    expect(response.data.addresses[0]).toMatchObject({ zipcode: address.zipcode, street: address.street });
  });

  test('campo legado "phone" deve virar o telefone principal', {
    annotation: {
      type: 'regra',
      description: 'RN-CLI-006: o campo legado "phone" cria o telefone principal com tipo celular_sem_whatsapp',
    },
  }, async ({ clientsClient }) => {
    const response = await clientsClient.create(buildClientPF({ phones: undefined, phone: '11987654321' }));

    expect(response.status).toBe(201);
    expect(response).toMatchContract(clientSchema);
    expect(response.data.primaryPhone).toMatchObject({
      number: '11987654321',
      type: 'celular_sem_whatsapp',
      isPrimary: true,
    });
  });
});

test.describe('POST /clients — documento duplicado', () => {
  test('não deve permitir CPF já cadastrado', {
    annotation: { type: 'regra', description: 'RN-CLI-002: CPF é único por tenant (409)' },
  }, async ({ clientsClient, createClient }) => {
    const existing = await createClient();

    const response = await clientsClient.create(buildClientPF({ pf: { cpf: existing.pf!.cpf } }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Ja existe um cliente com esse CPF neste tenant');
  });

  test('CPF de cliente desativado continua bloqueado', {
    annotation: {
      type: 'regra',
      description: 'RN-CLI-003: desativar o cliente não libera o CPF para um novo cadastro (409)',
    },
  }, async ({ clientsClient, createClient }) => {
    const inactive = await createClient(undefined, { active: false });

    const response = await clientsClient.create(buildClientPF({ pf: { cpf: inactive.pf!.cpf } }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
  });
});

test.describe('POST /clients — telefone principal', () => {
  const rule = {
    type: 'regra',
    description: 'RN-CLI-001: o cliente deve ter exatamente 1 telefone principal (não documentado no Swagger)',
  };

  test('não deve cadastrar cliente sem telefone', { annotation: rule }, async ({ clientsClient }) => {
    const response = await clientsClient.create(buildClientPF({ phones: undefined }));

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Cliente deve ter pelo menos 1 telefone principal');
  });

  test('não deve cadastrar cliente sem telefone marcado como principal', { annotation: rule }, async ({ clientsClient }) => {
    const response = await clientsClient.create(buildClientPF({ phones: [buildPhone({ isPrimary: false })] }));

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Cliente deve ter exatamente 1 telefone principal');
  });

  test('não deve cadastrar cliente com dois telefones principais', { annotation: rule }, async ({ clientsClient }) => {
    const response = await clientsClient.create(buildClientPF({ phones: [buildPhone(), buildPhone({ type: 'comercial' })] }));

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Cliente deve ter exatamente 1 telefone principal');
  });
});

test.describe('POST /clients — validação de campos', () => {
  /**
   * Teste orientado a dados: a mesma verificação roda para cada caso da tabela.
   * Para cobrir um novo caso de validação, basta adicionar uma linha.
   */
  const invalidCases: { scenario: string; payload: () => Partial<CreateClientRequest>; expected: string[] }[] = [
    {
      scenario: 'corpo vazio',
      payload: () => ({}),
      expected: ['personType deve ser PF ou PJ', 'name should not be empty'],
    },
    {
      scenario: 'nome com mais de 255 caracteres',
      payload: () => buildClientPF({ name: 'a'.repeat(256) }),
      expected: ['name must be shorter than or equal to 255 characters'],
    },
    {
      scenario: 'e-mail em formato inválido',
      payload: () => buildClientPF({ email: 'nao-e-um-email' }),
      expected: ['email must be an email'],
    },
    {
      scenario: 'pessoa física sem o bloco "pf"',
      payload: () => buildClientPF({ pf: undefined }),
      expected: ['pf e obrigatorio para Pessoa Fisica'],
    },
    {
      scenario: 'CPF com dígito verificador errado',
      payload: () => buildClientPF({ pf: { cpf: withWrongCheckDigit(generateCpf()) } }),
      expected: ['pf.CPF invalido'],
    },
    {
      scenario: 'CPF com máscara (pontos e traço)',
      payload: () => buildClientPF({ pf: { cpf: formatCpf(generateCpf()) } }),
      expected: ['pf.CPF deve conter apenas digitos numericos'],
    },
    {
      scenario: 'CNPJ inválido',
      payload: () => buildClientPJ({ pj: buildPj({ cnpj: '11111111111111' }) }),
      expected: ['pj.CNPJ invalido'],
    },
    {
      scenario: 'PJ contribuinte sem inscrição estadual',
      payload: () => buildClientPJ({ pj: buildPj({ ieIndicator: 'contribuinte' }) }),
      expected: ['pj.ie e obrigatoria quando ieIndicator e contribuinte'],
    },
    {
      scenario: 'endereço com CEP e UF inválidos',
      payload: () => buildClientPF({ addresses: [buildAddress({ zipcode: '123', state: 'XYZ' })] }),
      expected: ['addresses.0.CEP deve ter exatamente 8 digitos', 'addresses.0.Estado deve ter exatamente 2 caracteres'],
    },
  ];

  for (const { scenario, payload, expected } of invalidCases) {
    test(`deve recusar cadastro com ${scenario}`, async ({ clientsClient }) => {
      const response = await clientsClient.create(payload());

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      for (const message of expected) {
        expect(response.errorMessages).toContain(message);
      }
    });
  }
});
