import type { UserData } from '@schemas/user.schema';
import { BaseClient } from '../base.client';

export type { UserData };

export class UsersClient extends BaseClient {
  /** Dados do usuário dono do token */
  me() {
    return this.get<UserData>('users/me');
  }
}
