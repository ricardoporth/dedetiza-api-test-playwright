import { BaseClient } from '../base.client';

export interface PermissionData {
  id: string;
  /** Identificador no formato "modulo:acao". Ex.: "clients:create" */
  slug: string;
  module: string;
  description: string;
  createdAt: string;
}

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
