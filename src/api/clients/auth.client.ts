import type { LoginData } from '@schemas/auth.schema';
import { BaseClient } from '../base.client';

export type { LoginData };

export interface LoginRequest {
  tenantId: string;
  email: string;
  password: string;
}

/**
 * ATENÇÃO: o login aceita só 5 tentativas por minuto (x-ratelimit-limit: 5).
 */
export class AuthClient extends BaseClient {
  /** Partial<> permite enviar corpos incompletos nos testes de validação. */
  login(credentials: Partial<LoginRequest>) {
    return this.post<LoginData>('auth/login', { body: credentials });
  }
}
