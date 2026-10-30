import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import type { CreateServiceTypeRequest } from '@api/clients/service-types.client';
import { buildFullServiceType, buildServiceType, uniqueInternalCode } from '@factories/service-type.factory';
import { serviceTypeSchema } from '@schemas/service-type.schema';
import { serviceTypeHeuristics } from '@utils/contract-heuristics';
import { decodeJwtPayload } from '@utils/jwt';

test.describe('POST /service-types — caminho feliz', () => {
  test('deve cadastrar tipo de serviço só com o nome, usando os padrões @smoke', async ({ serviceTypesClient, adminToken }) => {
    // Arrange
    const payload = buildServiceType();

    // Act
    const response = await serviceTypesClient.create(payload);

    // Assert
    expect(response.status).toBe(201);
    expect(response).toMatchContract(serviceTypeSchema);
    expect(response.data).toMatchObject({
      name: payload.name,
      internalCode: null,
      description: null,
      serviceGuaranteeMonths: null,
      documentationGuaranteeMonths: null,
      status: 'active',
      active: true,
      requiresCertificate: false,
      suggestedMaterials: [],
    });
    expect(serviceTypeHeuristics(response.data, { tenantId: decodeJwtPayload(adminToken).tenantId })).toEqual([]);
  });

  test('deve cadastrar tipo de serviço com todos os campos', async ({ serviceTypesClient }) => {
    const payload = buildFullServiceType();

    const response = await serviceTypesClient.create(payload);

    expect(response.status).toBe(201);
    expect(response).toMatchContract(serviceTypeSchema);
    const { suggestedMaterials: _, ...expected } = payload;
    expect(response.data).toMatchObject(expected);
  });

  test('deve cadastrar com materiais sugeridos, devolvendo o material completo', async ({ serviceTypesClient, createMaterial, adminToken }) => {
    const [inseticida, armadilha] = [await createMaterial(), await createMaterial()];

    const response = await serviceTypesClient.create(
      buildServiceType({
        suggestedMaterials: [
          { materialId: inseticida.id, quantity: 2.5 },
          { materialId: armadilha.id, quantity: 0.001 },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(response).toMatchContract(serviceTypeSchema);
    const suggested = response.data.suggestedMaterials;
    expect(suggested.map((item) => [item.materialId, item.quantity])).toEqual([
      [inseticida.id, '2.5'],
      [armadilha.id, '0.001'],
    ]);
    expect(suggested[0]?.material).toEqual(inseticida);
    expect(serviceTypeHeuristics(response.data, { tenantId: decodeJwtPayload(adminToken).tenantId })).toEqual([]);
  });

  test('deve aceitar a quantidade sugerida no limite de 3 casas decimais', async ({ serviceTypesClient, createMaterial }) => {
    const material = await createMaterial();

    const response = await serviceTypesClient.create(
      buildServiceType({ suggestedMaterials: [{ materialId: material.id, quantity: 1.234 }] }),
    );

    expect(response.status).toBe(201);
    expect(response.data.suggestedMaterials[0]?.quantity).toBe('1.234');
  });

  test('deve aceitar nome com 255 caracteres (limite máximo)', async ({ serviceTypesClient }) => {
    const name = buildServiceType().name.padEnd(255, 'a');

    const response = await serviceTypesClient.create({ name });

    expect(response.status).toBe(201);
    expect(response.data.name).toBe(name);
  });

  test('deve aceitar código interno com 50 caracteres (limite máximo)', async ({ serviceTypesClient }) => {
    const internalCode = uniqueInternalCode().padEnd(50, 'X');

    const response = await serviceTypesClient.create(buildServiceType({ internalCode }));

    expect(response.status).toBe(201);
    expect(response.data.internalCode).toBe(internalCode);
  });

  test('deve aceitar garantias de 0 meses (sem garantia)', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.create(
      buildServiceType({ serviceGuaranteeMonths: 0, documentationGuaranteeMonths: 0 }),
    );

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({ serviceGuaranteeMonths: 0, documentationGuaranteeMonths: 0 });
  });

  test('deve guardar acentos e emoji sem alterar o texto', async ({ serviceTypesClient }) => {
    const payload = buildServiceType({ description: 'Ação em área úmida — inclui sanitização ✓ 🐜' });

    const response = await serviceTypesClient.create(payload);

    expect(response.status).toBe(201);
    expect(response.data.description).toBe(payload.description);
  });

  test('deve guardar texto com HTML como texto puro (sem executar nem alterar)', async ({ serviceTypesClient }) => {
    const payload = buildServiceType({ description: '<script>alert("qa")</script><b>negrito</b>' });

    const response = await serviceTypesClient.create(payload);

    expect(response.status).toBe(201);
    expect(response.data.description).toBe(payload.description);
  });
});

test.describe('POST /service-types — exceções (regras de negócio)', () => {
  test('não deve permitir nome já cadastrado', {
    annotation: { type: 'regra', description: 'RN-STP-002: o nome do tipo de serviço é único por tenant (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const existing = await createServiceType();

    const response = await serviceTypesClient.create(buildServiceType({ name: existing.name }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Já existe um tipo de serviço com esse nome neste tenant');
  });

  test('nome de tipo desativado continua bloqueado', {
    annotation: { type: 'regra', description: 'RN-STP-004: desativar o tipo de serviço não libera o nome (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const inactive = await createServiceType(undefined, { active: false });

    const response = await serviceTypesClient.create(buildServiceType({ name: inactive.name }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
  });

  test('não deve permitir código interno já cadastrado', {
    annotation: { type: 'regra', description: 'RN-STP-003: o código interno é único por tenant (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const existing = await createServiceType(buildServiceType({ internalCode: uniqueInternalCode() }));

    const response = await serviceTypesClient.create(buildServiceType({ internalCode: existing.internalCode }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Já existe um tipo de serviço com esse código interno neste tenant');
  });

  test('não deve permitir o mesmo nome escrito com letras maiúsculas', {
    annotation: { type: 'bug', description: 'BUG-008: nome duplicado com maiúsculas/minúsculas ou espaços nas pontas é aceito' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    // Bug conhecido: hoje a API responde 201. Quando corrigirem, remova esta linha.
    // Relatório: bugs/BUG-008-nome-de-tipo-de-servico-duplicado.md
    test.fail();
    const existing = await createServiceType();

    const response = await serviceTypesClient.create({ name: existing.name.toUpperCase() });

    expect(response.status).toBe(409);
  });

  test('não deve permitir o mesmo nome com espaços nas pontas', {
    annotation: { type: 'bug', description: 'BUG-008: nome duplicado com maiúsculas/minúsculas ou espaços nas pontas é aceito' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    // Bug conhecido: hoje a API responde 201 e grava o nome com os espaços.
    // Relatório: bugs/BUG-008-nome-de-tipo-de-servico-duplicado.md
    test.fail();
    const existing = await createServiceType();

    const response = await serviceTypesClient.create({ name: `  ${existing.name}  ` });

    expect(response.status).toBe(409);
  });

  test('"internalCode": null deve ser aceito como "sem código"', {
    annotation: { type: 'bug', description: 'BUG-007: internalCode null é tratado como um código e colide com outros tipos sem código (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    // Bug conhecido: hoje a API responde 409 "código interno já cadastrado" sempre que já existe
    // algum tipo sem código. Relatório: bugs/BUG-007-internal-code-null-gera-conflito.md
    test.fail();
    await createServiceType(); // garante que existe outro tipo sem código interno

    const response = await serviceTypesClient.create(buildServiceType({ internalCode: null }));

    expect(response.status).toBe(201);
    expect(response.data.internalCode).toBeNull();
  });

  test('"status" e "active" ficam sempre coerentes; quando divergem, vale o status', {
    annotation: { type: 'regra', description: 'RN-STP-005: status e active são sincronizados; status prevalece quando os dois divergem' },
  }, async ({ serviceTypesClient }) => {
    const cases: [Partial<CreateServiceTypeRequest>, { status: string; active: boolean }][] = [
      [{ status: 'inactive' }, { status: 'inactive', active: false }],
      [{ active: false }, { status: 'inactive', active: false }],
      [{ status: 'inactive', active: true }, { status: 'inactive', active: false }],
      [{ status: 'active', active: true }, { status: 'active', active: true }],
    ];

    for (const [fields, expected] of cases) {
      const response = await serviceTypesClient.create(buildServiceType(fields));

      expect.soft(response.status, JSON.stringify(fields)).toBe(201);
      expect.soft(response.data, JSON.stringify(fields)).toMatchObject(expected);
    }
  });

  test('deve recusar material sugerido que não existe', {
    annotation: { type: 'regra', description: 'RN-STP-006: o material sugerido precisa existir no tenant (404)' },
  }, async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.create(
      buildServiceType({ suggestedMaterials: [{ materialId: randomUUID(), quantity: 1 }] }),
    );

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Material não encontrado');
  });

  test('deve recusar material sugerido inativo', {
    annotation: { type: 'regra', description: 'RN-STP-007: material inativo não pode ser material sugerido (400)' },
  }, async ({ serviceTypesClient, createMaterial }) => {
    const inactive = await createMaterial({ active: false });

    const response = await serviceTypesClient.create(
      buildServiceType({ suggestedMaterials: [{ materialId: inactive.id, quantity: 1 }] }),
    );

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Material inativo não pode ser usado como material padrão');
  });

  test('deve recusar o mesmo material duas vezes na lista', {
    annotation: { type: 'regra', description: 'RN-STP-008: um material aparece no máximo uma vez nos materiais sugeridos (409)' },
  }, async ({ serviceTypesClient, createMaterial }) => {
    const material = await createMaterial();

    const response = await serviceTypesClient.create(
      buildServiceType({
        suggestedMaterials: [
          { materialId: material.id, quantity: 1 },
          { materialId: material.id, quantity: 2 },
        ],
      }),
    );

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Materiais sugeridos duplicados no mesmo tipo de serviço');
  });
});

test.describe('POST /service-types — negativos (validação de campos)', () => {
  /**
   * Teste orientado a dados: a mesma verificação roda para cada linha da tabela.
   * Para cobrir um novo caso de validação, basta adicionar uma linha.
   */
  const invalidCases: { scenario: string; payload: () => Record<string, unknown>; expected: string[] }[] = [
    {
      scenario: 'corpo vazio',
      payload: () => ({}),
      expected: ['name should not be empty', 'name must be a string'],
    },
    { scenario: 'nome vazio', payload: () => buildServiceType({ name: '' }), expected: ['name should not be empty'] },
    {
      scenario: 'nome com 256 caracteres',
      payload: () => buildServiceType({ name: 'a'.repeat(256) }),
      expected: ['name must be shorter than or equal to 255 characters'],
    },
    { scenario: 'nome numérico', payload: () => ({ name: 123 }), expected: ['name must be a string'] },
    {
      scenario: 'código interno vazio',
      payload: () => buildServiceType({ internalCode: '' }),
      expected: ['internalCode should not be empty'],
    },
    {
      scenario: 'código interno com 51 caracteres',
      payload: () => buildServiceType({ internalCode: 'C'.repeat(51) }),
      expected: ['internalCode must be shorter than or equal to 50 characters'],
    },
    {
      scenario: 'garantias negativas',
      payload: () => buildServiceType({ serviceGuaranteeMonths: -1, documentationGuaranteeMonths: -1 }),
      expected: ['serviceGuaranteeMonths must not be less than 0', 'documentationGuaranteeMonths must not be less than 0'],
    },
    {
      scenario: 'garantia com meses fracionados',
      payload: () => buildServiceType({ serviceGuaranteeMonths: 1.5 }),
      expected: ['serviceGuaranteeMonths must be an integer number'],
    },
    {
      scenario: 'status fora da lista',
      payload: () => ({ ...buildServiceType(), status: 'deleted' }),
      expected: ['status must be one of the following values: active, inactive'],
    },
    {
      scenario: 'requiresCertificate como texto',
      payload: () => ({ ...buildServiceType(), requiresCertificate: 'sim' }),
      expected: ['requiresCertificate must be a boolean value'],
    },
    {
      scenario: 'materiais sugeridos como objeto (não lista)',
      payload: () => ({ ...buildServiceType(), suggestedMaterials: { materialId: randomUUID(), quantity: 1 } }),
      expected: ['suggestedMaterials must be an array'],
    },
    {
      scenario: 'material sugerido com id inválido e quantidade zero',
      payload: () => buildServiceType({ suggestedMaterials: [{ materialId: 'x', quantity: 0 }] }),
      expected: ['suggestedMaterials.0.materialId must be a UUID', 'suggestedMaterials.0.quantity must not be less than 0.001'],
    },
    {
      scenario: 'quantidade com mais de 3 casas decimais',
      payload: () => buildServiceType({ suggestedMaterials: [{ materialId: randomUUID(), quantity: 1.0001 }] }),
      expected: ['suggestedMaterials.0.quantity must be a number conforming to the specified constraints'],
    },
  ];

  for (const { scenario, payload, expected } of invalidCases) {
    test(`deve recusar cadastro com ${scenario}`, async ({ serviceTypesClient }) => {
      const response = await serviceTypesClient.create(payload());

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      for (const message of expected) {
        expect(response.errorMessages).toContain(message);
      }
    });
  }

  for (const field of ['tenantId', 'id', 'createdAt']) {
    test(`deve recusar o campo de sistema "${field}" no corpo`, {
      annotation: { type: 'regra', description: 'RN-STP-014: campos fora do contrato de entrada são recusados (400)' },
    }, async ({ serviceTypesClient }) => {
      const response = await serviceTypesClient.create({ ...buildServiceType(), [field]: randomUUID() });

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(`property ${field} should not exist`);
    });
  }

  test('deve recusar nome só com espaços', {
    annotation: { type: 'bug', description: 'BUG-009: nome só com espaços ("   ") é aceito e cria tipo de serviço sem nome visível' },
  }, async ({ serviceTypesClient }) => {
    // Bug conhecido: hoje a API responde 201. Quando corrigirem, remova esta linha.
    // Relatório: bugs/BUG-009-nome-de-tipo-de-servico-so-com-espacos.md
    test.fail();
    // Espaços e tabs sorteados: um nome só de espaços fixo ("   ") já existe e daria 409, não o 201 do bug
    const blankName = Array.from({ length: 40 }, () => (Math.random() < 0.5 ? ' ' : '	')).join('');

    const response = await serviceTypesClient.create({ name: blankName });

    expect(response.status).toBe(400);
  });
});
