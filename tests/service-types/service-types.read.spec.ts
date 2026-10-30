import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { buildFullServiceType, buildServiceType, uniqueInternalCode } from '@factories/service-type.factory';
import { serviceTypeListSchema, serviceTypeSchema } from '@schemas/service-type.schema';
import { paginationHeuristics } from '@utils/contract-heuristics';

test.describe('GET /service-types/{id} — caminho feliz', () => {
  test('deve detalhar o tipo de serviço com os materiais sugeridos @smoke', async ({ serviceTypesClient, createServiceType, createMaterial }) => {
    const material = await createMaterial();
    const created = await createServiceType(
      buildFullServiceType({ suggestedMaterials: [{ materialId: material.id, quantity: 3 }] }),
    );

    const response = await serviceTypesClient.getById(created.id);

    expect(response.status).toBe(200);
    expect(response).toMatchContract(serviceTypeSchema);
    expect(response.data).toEqual(created);
  });

  test('deve consultar tipo de serviço desativado', {
    annotation: { type: 'regra', description: 'RN-STP-010: o DELETE é soft delete — o tipo desativado continua consultável' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const inactive = await createServiceType(undefined, { active: false });

    const response = await serviceTypesClient.getById(inactive.id);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ id: inactive.id, status: 'inactive', active: false });
  });

  test('deve aceitar o id em letras maiúsculas', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();

    const response = await serviceTypesClient.getById(created.id.toUpperCase());

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(created.id);
  });
});

test.describe('GET /service-types/{id} — exceções (404)', () => {
  const notFoundCases = [
    { scenario: 'UUID que não existe', id: async () => randomUUID() },
    { scenario: 'UUID nulo (só zeros)', id: async () => '00000000-0000-0000-0000-000000000000' },
  ];

  for (const { scenario, id } of notFoundCases) {
    test(`deve retornar 404 para ${scenario}`, async ({ serviceTypesClient }) => {
      const response = await serviceTypesClient.getById(await id());

      expect(response.status).toBe(404);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Tipo de serviço não encontrado');
    });
  }

  test('deve retornar 404 para o id de outra entidade (um material)', async ({ serviceTypesClient, createMaterial }) => {
    // Um id válido de OUTRA tabela não pode devolver dados de tipo de serviço
    const material = await createMaterial();

    const response = await serviceTypesClient.getById(material.id);

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
  });
});

test.describe('GET /service-types/{id} — negativos (id inválido: 400, nunca 500)', () => {
  const malformedIds = [
    ['texto qualquer', 'abc'],
    ['UUID sem um caractere', randomUUID().slice(0, -1)],
    ['UUID com caractere fora do hexadecimal', `${randomUUID().slice(0, -1)}g`],
    ['injeção de SQL', "1' OR '1'='1"],
    ['caminho relativo', '..%2F..%2Fusers'],
  ];

  for (const [scenario, id] of malformedIds) {
    test(`deve recusar ${scenario}`, async ({ serviceTypesClient }) => {
      const response = await serviceTypesClient.getById(id!);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Validation failed (uuid is expected)');
    });
  }
});

test.describe('GET /service-types — caminho feliz', () => {
  test('deve listar com os dados de paginação @smoke', async ({ serviceTypesClient, createServiceType }) => {
    await createServiceType();

    const response = await serviceTypesClient.list({ page: 1, limit: 5 });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(serviceTypeListSchema);
    expect(response.data.items.length).toBeGreaterThan(0);
    expect(paginationHeuristics(response.data, { page: 1, limit: 5 })).toEqual([]);
  });

  test('deve usar página 1 e 20 itens por padrão', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.list();

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ page: 1, limit: 20 });
    expect(paginationHeuristics(response.data, { page: 1, limit: 20 })).toEqual([]);
  });

  test('deve filtrar pelo nome com busca parcial, sem diferenciar maiúsculas', {
    annotation: { type: 'regra', description: 'RN-STP-012: o filtro "name" é busca parcial e não diferencia maiúsculas' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();
    const unique = created.name.split(' ').at(-1)!; // sufixo único gerado pela factory

    const response = await serviceTypesClient.list({ name: unique.toUpperCase() });

    expect(response.status).toBe(200);
    expect(response.data.items.map((item) => item.id)).toEqual([created.id]);
  });

  test('deve filtrar pelo código interno', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType(buildServiceType({ internalCode: uniqueInternalCode() }));

    const response = await serviceTypesClient.list({ internalCode: created.internalCode! });

    expect(response.status).toBe(200);
    expect(response.data.items.map((item) => item.id)).toEqual([created.id]);
  });

  const statusFilters = [
    { filter: { status: 'active' as const }, expectActive: true },
    { filter: { status: 'inactive' as const }, expectActive: false },
    { filter: { active: true }, expectActive: true },
    { filter: { active: false }, expectActive: false },
  ];

  for (const { filter, expectActive } of statusFilters) {
    test(`filtro ${JSON.stringify(filter)} deve trazer só ${expectActive ? 'ativos' : 'inativos'}`, async ({ serviceTypesClient, createServiceType }) => {
      const [active, inactive] = [await createServiceType(), await createServiceType(undefined, { active: false })];
      const mine = (ids: string[]) => ids.filter((id) => id === active.id || id === inactive.id);

      const response = await serviceTypesClient.list({ ...filter, name: '[QA-AUTO]', limit: 100 });

      expect(response.status).toBe(200);
      for (const item of response.data.items) {
        expect.soft(item.active, `item ${item.name}`).toBe(expectActive);
      }
      // os dois recém-criados podem não estar na 1ª página; quando estão, só o certo aparece
      expect(mine(response.data.items.map((item) => item.id))).not.toContain(expectActive ? inactive.id : active.id);
    });
  }

  test('status=all deve trazer ativos e inativos', async ({ serviceTypesClient, createServiceType }) => {
    const inactive = await createServiceType(undefined, { active: false });

    const response = await serviceTypesClient.list({ status: 'all', name: inactive.name });

    expect(response.status).toBe(200);
    expect(response.data.items.map((item) => item.id)).toEqual([inactive.id]);
  });

  test('página além do fim deve vir vazia, com o total', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.list({ page: 99_999, limit: 100 });

    expect(response.status).toBe(200);
    expect(response.data.items).toEqual([]);
    expect(response.data.total).toBeGreaterThan(0);
  });

  test('filtro sem resultado deve devolver lista vazia, não 404', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.list({ name: `inexistente-${randomUUID()}` });

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ items: [], total: 0 });
  });

  test('"_" e "%" no filtro devem ser tratados como texto, não como curinga', {
    annotation: { type: 'bug', description: 'BUG-013: o filtro "name" trata "_" e "%" como curingas do SQL (LIKE sem escape)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    // Bug conhecido: hoje "_" casa com qualquer caractere e "%" com qualquer texto.
    // Relatório: bugs/BUG-013-filtro-trata-curingas-do-sql.md
    test.fail();
    // "_" e "%" são curingas do LIKE no SQL. Se a API não escapar, "_" casa com qualquer caractere.
    const created = await createServiceType();
    const unique = created.name.split(' ').at(-1)!;
    const withWildcard = `${unique.slice(0, 3)}_${unique.slice(4)}`; // troca o 4º caractere por "_"

    const response = await serviceTypesClient.list({ name: withWildcard });

    expect(response.status).toBe(200);
    expect(response.data.items.map((item) => item.id)).not.toContain(created.id);
  });
});

test.describe('GET /service-types — negativos (parâmetros inválidos)', () => {
  const invalidQueries: { scenario: string; query: Record<string, string | number>; expected: string }[] = [
    { scenario: 'limit acima de 100', query: { limit: 101 }, expected: 'limit must not be greater than 100' },
    { scenario: 'limit zero', query: { limit: 0 }, expected: 'limit must not be less than 1' },
    { scenario: 'página zero', query: { page: 0 }, expected: 'page must not be less than 1' },
    { scenario: 'página não numérica', query: { page: 'abc' }, expected: 'page must be an integer number' },
    { scenario: 'status fora da lista', query: { status: 'x' }, expected: 'status must be one of the following values: active, inactive, all' },
    { scenario: 'active não booleano', query: { active: 'talvez' }, expected: 'active must be a boolean value' },
    { scenario: 'nome com 256 caracteres', query: { name: 'a'.repeat(256) }, expected: 'name must be shorter than or equal to 255 characters' },
    { scenario: 'código interno com 51 caracteres', query: { internalCode: 'C'.repeat(51) }, expected: 'internalCode must be shorter than or equal to 50 characters' },
  ];

  for (const { scenario, query, expected } of invalidQueries) {
    test(`deve recusar ${scenario}`, async ({ serviceTypesClient }) => {
      const response = await serviceTypesClient.list(query);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(expected);
    });
  }
});
