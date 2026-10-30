import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { withoutCoverage } from '@api/base.client';
import type { UpdateServiceTypeRequest } from '@api/clients/service-types.client';
import { buildFullServiceType, buildServiceType, uniqueInternalCode } from '@factories/service-type.factory';
import { serviceTypeSchema } from '@schemas/service-type.schema';

test.describe('PATCH /service-types/{id} — caminho feliz', () => {
  test('deve alterar só os campos enviados @smoke', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType(buildFullServiceType());
    const changes = { name: buildServiceType().name, description: 'Nova descrição', serviceGuaranteeMonths: 3 };

    const response = await serviceTypesClient.update(created.id, changes);

    expect(response.status).toBe(200);
    expect(response).toMatchContract(serviceTypeSchema);
    expect(response.data).toEqual({ ...created, ...changes, updatedAt: response.data.updatedAt });
    expect(Date.parse(response.data.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
  });

  test('a alteração deve ser persistida (GET devolve o mesmo que o PATCH)', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();
    const updated = await serviceTypesClient.update(created.id, { requiresCertificate: true, documentationGuaranteeMonths: 6 });

    const response = await withoutCoverage(() => serviceTypesClient.getById(created.id));

    expect(updated.status).toBe(200);
    expect(response.data).toEqual(updated.data);
  });

  test('corpo vazio não altera nada', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType(buildFullServiceType());

    const response = await serviceTypesClient.update(created.id, {});

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ ...created, updatedAt: expect.any(String) });
  });

  test('deve limpar campos opcionais enviando null', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType(buildFullServiceType());

    const response = await serviceTypesClient.update(created.id, {
      description: null,
      serviceGuaranteeMonths: null,
      documentationGuaranteeMonths: null,
    });

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ description: null, serviceGuaranteeMonths: null, documentationGuaranteeMonths: null });
  });

  test('deve manter o próprio nome sem acusar duplicidade', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();

    const response = await serviceTypesClient.update(created.id, { name: created.name });

    expect(response.status).toBe(200);
  });

  test('deve desativar e reativar pelo status', {
    annotation: { type: 'regra', description: 'RN-STP-005: status e active são sincronizados; status prevalece quando os dois divergem' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();

    const inactive = await serviceTypesClient.update(created.id, { status: 'inactive' });
    const reactivated = await serviceTypesClient.update(created.id, { active: true });
    const conflicting = await serviceTypesClient.update(created.id, { status: 'inactive', active: true });

    expect(inactive.data).toMatchObject({ status: 'inactive', active: false });
    expect(reactivated.data).toMatchObject({ status: 'active', active: true });
    expect(conflicting.data).toMatchObject({ status: 'inactive', active: false });
  });

  test('materiais sugeridos enviados substituem a lista atual', {
    annotation: { type: 'regra', description: 'RN-STP-009: no PATCH, "suggestedMaterials" substitui a lista inteira' },
  }, async ({ serviceTypesClient, createServiceType, createMaterial }) => {
    const [old, novo] = [await createMaterial(), await createMaterial()];
    const created = await createServiceType(buildServiceType({ suggestedMaterials: [{ materialId: old.id, quantity: 1 }] }));

    const response = await serviceTypesClient.update(created.id, { suggestedMaterials: [{ materialId: novo.id, quantity: 4.5 }] });

    expect(response.status).toBe(200);
    expect(response).toMatchContract(serviceTypeSchema);
    expect(response.data.suggestedMaterials.map((item) => [item.materialId, item.quantity])).toEqual([[novo.id, '4.5']]);
  });

  test('lista vazia remove todos os materiais sugeridos', async ({ serviceTypesClient, createServiceType, createMaterial }) => {
    const material = await createMaterial();
    const created = await createServiceType(buildServiceType({ suggestedMaterials: [{ materialId: material.id, quantity: 1 }] }));

    const response = await serviceTypesClient.update(created.id, { suggestedMaterials: [] });

    expect(response.status).toBe(200);
    expect(response.data.suggestedMaterials).toEqual([]);
  });

  test('trocar os materiais sugeridos deve atualizar o updatedAt', {
    annotation: { type: 'bug', description: 'BUG-012: trocar só os materiais sugeridos não atualiza o updatedAt do tipo de serviço' },
  }, async ({ serviceTypesClient, createServiceType, createMaterial }) => {
    // Bug conhecido (heurística de contrato): o updatedAt continua igual ao de antes da alteração.
    // Relatório: bugs/BUG-012-updatedat-nao-muda-ao-trocar-materiais.md
    test.fail();
    const material = await createMaterial();
    const created = await createServiceType();

    const response = await serviceTypesClient.update(created.id, { suggestedMaterials: [{ materialId: material.id, quantity: 1 }] });

    expect(response.status).toBe(200);
    expect(Date.parse(response.data.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
  });
});

test.describe('PATCH /service-types/{id} — exceções (regras de negócio)', () => {
  test('não deve renomear para um nome que já existe', {
    annotation: { type: 'regra', description: 'RN-STP-002: o nome do tipo de serviço é único por tenant (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const [existing, other] = [await createServiceType(), await createServiceType()];

    const response = await serviceTypesClient.update(other.id, { name: existing.name });

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Já existe um tipo de serviço com esse nome neste tenant');
  });

  test('não deve usar código interno de outro tipo', {
    annotation: { type: 'regra', description: 'RN-STP-003: o código interno é único por tenant (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const existing = await createServiceType(buildServiceType({ internalCode: uniqueInternalCode() }));
    const other = await createServiceType();

    const response = await serviceTypesClient.update(other.id, { internalCode: existing.internalCode });

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
  });

  test('deve limpar o código interno enviando null', {
    annotation: { type: 'bug', description: 'BUG-007: internalCode null é tratado como um código e colide com outros tipos sem código (409)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    // Bug conhecido: hoje a API responde 409, então não há como remover o código de um tipo.
    // Relatório: bugs/BUG-007-internal-code-null-gera-conflito.md
    test.fail();
    await createServiceType(); // outro tipo sem código interno
    const created = await createServiceType(buildServiceType({ internalCode: uniqueInternalCode() }));

    const response = await serviceTypesClient.update(created.id, { internalCode: null });

    expect(response.status).toBe(200);
    expect(response.data.internalCode).toBeNull();
  });

  test('deve recusar material sugerido inexistente', {
    annotation: { type: 'regra', description: 'RN-STP-006: o material sugerido precisa existir no tenant (404)' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();

    const response = await serviceTypesClient.update(created.id, { suggestedMaterials: [{ materialId: randomUUID(), quantity: 1 }] });

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Material não encontrado');
  });

  test('deve retornar 404 para tipo de serviço inexistente', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.update(randomUUID(), { name: buildServiceType().name });

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Tipo de serviço não encontrado');
  });
});

test.describe('PATCH /service-types/{id} — negativos (validação)', () => {
  const invalidCases: { scenario: string; payload: Record<string, unknown> | unknown[]; expected: string[] }[] = [
    { scenario: 'nome vazio', payload: { name: '' }, expected: ['name should not be empty'] },
    { scenario: 'nome com 256 caracteres', payload: { name: 'a'.repeat(256) }, expected: ['name must be shorter than or equal to 255 characters'] },
    { scenario: 'código interno com 51 caracteres', payload: { internalCode: 'C'.repeat(51) }, expected: ['internalCode must be shorter than or equal to 50 characters'] },
    { scenario: 'garantia negativa', payload: { documentationGuaranteeMonths: -1 }, expected: ['documentationGuaranteeMonths must not be less than 0'] },
    { scenario: 'status fora da lista', payload: { status: 'deleted' }, expected: ['status must be one of the following values: active, inactive'] },
    {
      scenario: 'campos de sistema (id, tenantId, createdAt)',
      payload: { id: randomUUID(), tenantId: randomUUID(), createdAt: '2020-01-01T00:00:00.000Z' },
      expected: ['property id should not exist', 'property tenantId should not exist', 'property createdAt should not exist'],
    },
    { scenario: 'uma lista no lugar do objeto', payload: [1, 2], expected: ['property 0 should not exist'] },
  ];

  for (const { scenario, payload, expected } of invalidCases) {
    test(`deve recusar ${scenario}`, async ({ serviceTypesClient, createServiceType }) => {
      const created = await createServiceType();

      const response = await serviceTypesClient.update(created.id, payload);

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      for (const message of expected) {
        expect(response.errorMessages).toContain(message);
      }
    });
  }

  test('deve recusar id fora do formato UUID', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.update('abc', { name: 'x' });

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Validation failed (uuid is expected)');
  });

  /**
   * O Swagger documenta estes campos como "nullable" no PATCH. Enviar null deveria limpar o campo
   * (quando faz sentido) ou ser recusado com 400 — nunca derrubar a API com 500.
   */
  const nullFields: [keyof UpdateServiceTypeRequest, string][] = [
    ['name', 'nome é obrigatório: null deve ser recusado com 400'],
    ['status', 'status é obrigatório: null deve ser recusado com 400'],
    ['active', 'active é obrigatório: null deve ser recusado com 400'],
    ['requiresCertificate', 'requiresCertificate é obrigatório: null deve ser recusado com 400'],
    ['suggestedMaterials', 'suggestedMaterials null deve ser tratado como lista vazia ou recusado com 400'],
  ];

  for (const [field, expectation] of nullFields) {
    test(`"${field}": null não deve causar erro 500`, {
      annotation: [
        { type: 'bug', description: 'BUG-011: campos documentados como nullable causam 500 quando enviados como null' },
        { type: 'esperado', description: expectation },
      ],
    }, async ({ serviceTypesClient, createServiceType }) => {
      // Bug conhecido: hoje a API responde 500. Relatório: bugs/BUG-011-null-em-campos-nullable-causa-500.md
      test.fail();
      const created = await createServiceType();

      const response = await serviceTypesClient.update(created.id, { [field]: null });

      expect(response.status).toBeLessThan(500);
    });
  }
});
