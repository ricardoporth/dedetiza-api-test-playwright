import { expect } from '@playwright/test';
import { withoutCoverage } from '@api/base.client';
import type { ClientData, CreateClientRequest } from '@api/clients/clients.client';
import type { CreateUserRequest, UserData } from '@api/clients/users.client';
import { buildClientPF } from '@factories/client.factory';
import { buildUser } from '@factories/user.factory';
import { decodeJwtPayload } from '@utils/jwt';
import { test as api } from './api.fixtures';

/**
 * Camada 3 — preparação de dados ("Arrange").
 * Cria o que o teste precisa como PRÉ-CONDIÇÃO. Essas chamadas não contam para a
 * cobertura (não são o alvo do teste) e o que for criado é removido ao final.
 */
export interface DataFixtures {
  /**
   * Cria um cliente pronto para uso. Ex.:
   *   const client = await createClient();                        // PF padrão
   *   const pj = await createClient(buildClientPJ());              // PJ
   *   const inactive = await createClient(undefined, { active: false });
   */
  createClient: (payload?: CreateClientRequest, options?: { active?: boolean }) => Promise<ClientData>;

  /** Id do perfil "[QA-AUTO] Sem permissões" — o perfil seguro para usuários criados nos testes. */
  qaRoleId: string;

  /**
   * Cria um usuário pronto para uso (por padrão no perfil sem permissões). Ex.:
   *   const user = await createUser();
   *   const inactive = await createUser(undefined, { active: false });
   */
  createUser: (payload?: CreateUserRequest, options?: { active?: boolean }) => Promise<UserData>;
}

export const test = api.extend<DataFixtures>({
  createClient: async ({ clientsClient }, use) => {
    await use(async (payload = buildClientPF(), { active = true } = {}) =>
      withoutCoverage(async () => {
        const created = await clientsClient.create(payload);
        expect(created.status, `Falha ao preparar cliente: ${JSON.stringify(created.body)}`).toBe(201);
        if (active) return created.data;

        const deactivated = await clientsClient.deactivate(created.data.id);
        expect(deactivated.status, `Falha ao desativar cliente: ${JSON.stringify(deactivated.body)}`).toBe(200);
        // O DELETE devolve o cliente resumido: mantém o cadastro completo e atualiza só o que mudou
        return { ...created.data, active: deactivated.data.active, updatedAt: deactivated.data.updatedAt };
      }),
    );
  },

  qaRoleId: async ({ noPermissionToken }, use) => {
    await use(decodeJwtPayload(noPermissionToken).roleId);
  },

  createUser: async ({ usersClient, qaRoleId }, use) => {
    await use(async (payload = buildUser(qaRoleId), { active = true } = {}) =>
      withoutCoverage(async () => {
        const created = await usersClient.create(payload);
        expect(created.status, `Falha ao preparar usuário: ${JSON.stringify(created.body)}`).toBe(201);
        if (active) return created.data;

        const deactivated = await usersClient.deactivate(created.data.id);
        expect(deactivated.status, `Falha ao desativar usuário: ${JSON.stringify(deactivated.body)}`).toBe(200);
        return deactivated.data;
      }),
    );
  },

});
