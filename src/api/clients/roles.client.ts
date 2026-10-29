import type { RoleData } from '@schemas/role.schema';
import type { Paginated } from '../api-response';
import { BaseClient } from '../base.client';

export interface RoleFilters {
  page?: number;
  limit?: number;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
}

/** Perfis de acesso: agrupam as permissões que um usuário recebe. */
export class RolesClient extends BaseClient {
  list(filters: RoleFilters = {}) {
    return this.get<Paginated<RoleData>>('roles', { query: { ...filters } });
  }

  create(payload: CreateRoleRequest) {
    return this.post<RoleData>('roles', { body: payload });
  }
}
