import type { UserData } from '@schemas/user.schema';
import type { Paginated } from '../api-response';
import { BaseClient } from '../base.client';

export type { UserData };

// ---------- O que enviamos ----------

export interface CreateUserRequest {
  roleId: string;
  responsibleId?: string;
  name: string;
  cpf: string;
  rg?: string;
  cnh?: string;
  cnhValidity?: string;
  phone?: string;
  /** Obrigatório quando o perfil do usuário for gerente */
  email?: string;
  password: string;
  confirmPassword: string;
  active?: boolean;
  maxTechnicalDifficultyLevel?: 'low' | 'medium' | 'high';
  emergencyContactPhone?: string;
}

/** O admin pode redefinir a senha de outro usuário pelo campo "password". */
export type UpdateUserRequest = Partial<Omit<CreateUserRequest, 'confirmPassword'>>;

export interface UserFilters {
  page?: number;
  limit?: number;
  eligibleAsTechnician?: boolean;
  eligibleAsSeller?: boolean;
}

export class UsersClient extends BaseClient {
  /** Dados do usuário dono do token */
  me() {
    return this.get<UserData>('users/me');
  }

  getById(id: string) {
    return this.get<UserData>('users/{id}', { path: { id } });
  }

  list(filters: UserFilters = {}) {
    return this.get<Paginated<UserData>>('users', { query: { ...filters } });
  }

  create(payload: CreateUserRequest) {
    return this.post<UserData>('users', { body: payload });
  }

  update(id: string, payload: UpdateUserRequest) {
    return this.patch<UserData>('users/{id}', { path: { id }, body: payload });
  }
}
