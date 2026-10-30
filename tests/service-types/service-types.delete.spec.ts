import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { withoutCoverage } from '@api/base.client';
import { buildFullServiceType } from '@factories/service-type.factory';
import { serviceTypeSchema } from '@schemas/service-type.schema';

test.describe('DELETE /service-types/{id} — caminho feliz', () => {
  test('deve desativar o tipo de serviço (soft delete) @smoke', {
    annotation: { type: 'regra', description: 'RN-STP-010: o DELETE é soft delete — o tipo fica inativo e continua consultável' },
  }, async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType(buildFullServiceType());

    const response = await serviceTypesClient.deactivate(created.id);

    expect(response.status).toBe(200);
    expect(response).toMatchContract(serviceTypeSchema);
    // Só o estado muda: o restante do cadastro é mantido
    expect(response.data).toEqual({ ...created, status: 'inactive', active: false, updatedAt: response.data.updatedAt });

    const after = await withoutCoverage(() => serviceTypesClient.getById(created.id));
    expect(after.status).toBe(200);
    expect(after.data).toEqual(response.data);
  });

  test('desativar de novo deve continuar respondendo 200 (idempotente)', async ({ serviceTypesClient, createServiceType }) => {
    const inactive = await createServiceType(undefined, { active: false });

    const response = await serviceTypesClient.deactivate(inactive.id);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ status: 'inactive', active: false });
  });

  test('o tipo desativado sai do filtro de ativos e aparece no de inativos', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();
    await serviceTypesClient.deactivate(created.id);

    const [active, inactive] = await withoutCoverage(() =>
      Promise.all([
        serviceTypesClient.list({ name: created.name, status: 'active' }),
        serviceTypesClient.list({ name: created.name, status: 'inactive' }),
      ]),
    );

    expect(active.data.items).toEqual([]);
    expect(inactive.data.items.map((item) => item.id)).toEqual([created.id]);
  });

  test('o tipo desativado pode ser reativado pelo PATCH', async ({ serviceTypesClient, createServiceType }) => {
    const created = await createServiceType();
    await serviceTypesClient.deactivate(created.id);

    const response = await withoutCoverage(() => serviceTypesClient.update(created.id, { status: 'active' }));

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ status: 'active', active: true });
  });
});

test.describe('DELETE /service-types/{id} — exceções e negativos', () => {
  test('deve retornar 404 para tipo de serviço inexistente', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.deactivate(randomUUID());

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Tipo de serviço não encontrado');
  });

  test('deve recusar id fora do formato UUID', async ({ serviceTypesClient }) => {
    const response = await serviceTypesClient.deactivate('abc');

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Validation failed (uuid is expected)');
  });
});
