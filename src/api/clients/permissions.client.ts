import type { PermissionData } from '@schemas/permission.schema';
import { BaseClient } from '../base.client';

export type { PermissionData };

export class PermissionsClient extends BaseClient {
  /** Catálogo com todas as permissões que existem no sistema */
  list() {
    return this.get<PermissionData[]>('permissions');
  }

  /** Permissões do usuário dono do token, no formato "modulo:acao" */
  me() {
    return this.get<string[]>('permissions/me');
  }
}
