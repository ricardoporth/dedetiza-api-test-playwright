import { BaseClient } from '../base.client';

export interface UserData {
  id: string;
  name: string;
  cpf: string;
  rg: string | null;
  cnh: string | null;
  cnhValidity: string | null;
  phone: string | null;
  email: string;
  photoUrl: string | null;
  profile: string;
  maxTechnicalDifficultyLevel: string;
  responsible: string | null;
  active: boolean;
  emergencyContactPhone: string | null;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class UsersClient extends BaseClient {
  /** Dados do usuário dono do token */
  me() {
    return this.get<UserData>('users/me');
  }
}
