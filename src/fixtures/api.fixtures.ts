import { AuthClient } from '@api/clients/auth.client';
import { ClientsClient } from '@api/clients/clients.client';
import { HealthClient } from '@api/clients/health.client';
import { PermissionsClient } from '@api/clients/permissions.client';
import { RolesClient } from '@api/clients/roles.client';
import { UsersClient } from '@api/clients/users.client';
import { test as core } from './core.fixtures';

/**
 * Camada 2 — um client por módulo da API.
 * Clients de rotas protegidas já vêm com o token do admin e com o cleanup do teste.
 * Para testar 401, crie o client sem token: new UsersClient(request)
 */
export interface ApiFixtures {
  healthClient: HealthClient;
  authClient: AuthClient;
  usersClient: UsersClient;
  permissionsClient: PermissionsClient;
  clientsClient: ClientsClient;
  rolesClient: RolesClient;
}

export const test = core.extend<ApiFixtures>({
  // Rotas públicas
  healthClient: async ({ request }, use) => {
    await use(new HealthClient(request));
  },
  authClient: async ({ request }, use) => {
    await use(new AuthClient(request));
  },

  // Rotas protegidas — autenticadas como admin
  usersClient: async ({ request, adminToken, cleanup }, use) => {
    await use(new UsersClient(request, adminToken, cleanup));
  },
  permissionsClient: async ({ request, adminToken, cleanup }, use) => {
    await use(new PermissionsClient(request, adminToken, cleanup));
  },
  clientsClient: async ({ request, adminToken, cleanup }, use) => {
    await use(new ClientsClient(request, adminToken, cleanup));
  },
  rolesClient: async ({ request, adminToken, cleanup }, use) => {
    await use(new RolesClient(request, adminToken, cleanup));
  },
});
