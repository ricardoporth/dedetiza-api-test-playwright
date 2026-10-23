import { BaseClient } from '../base.client';

export interface LoginRequest {
  tenantId: string;
  email: string;
  password: string;
}

export interface LoginData {
  accessToken: string;
  expiresIn: string;
  user: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    roleId: string;
  };
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
