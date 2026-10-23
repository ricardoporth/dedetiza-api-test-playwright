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

  /**
   * Login que respeita o rate limit: se a API responder 429, espera o tempo que ela
   * mesma informa no header e tenta mais uma vez. Use no setup, nunca nos testes de login.
   */
  async loginRespectingRateLimit(credentials: LoginRequest) {
    const response = await this.login(credentials);
    if (response.status !== 429) return response;

    const waitSeconds = Number(response.header('retry-after') ?? response.header('x-ratelimit-reset') ?? 60);
    console.log(`  [auth] Limite de login atingido (429). Aguardando ${waitSeconds}s conforme informado pela API...`);
    await new Promise((resolve) => setTimeout(resolve, (waitSeconds + 1) * 1000));
    return this.login(credentials);
  }
}
