import { test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { Cleanup } from '@utils/cleanup';
import { API_CALL_ANNOTATION, formatApiCall } from '../coverage/annotations';
import { ApiResponse } from './api-response';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  /** Valores dos trechos {param} da rota. Ex.: { id: 'abc' } em 'clients/{id}' */
  path?: Record<string, string | number>;
  /** Query string. Valores undefined são ignorados. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Corpo da requisição, enviado como JSON */
  body?: unknown;
  /** Headers extras apenas desta chamada */
  headers?: Record<string, string>;
}

/**
 * Classe-mãe de todos os clients. Concentra o que é igual em qualquer módulo:
 *  - monta a URL a partir da rota no formato do Swagger ('clients/{id}')
 *  - envia o token de autenticação, quando houver
 *  - converte o corpo da resposta de JSON
 *  - registra a chamada para o relatório de cobertura
 *  - registra para limpeza o que o teste criar (quando recebe um Cleanup)
 *  - respeita o limite de requisições da API (429): espera o tempo informado e tenta de novo
 */
export abstract class BaseClient {
  /**
   * Com true (padrão), uma resposta 429 faz o client esperar o tempo que a API pede e repetir
   * a chamada. Desligue só nos testes que querem VER o 429:  client.retryOnRateLimit = false
   */
  retryOnRateLimit = true;

  constructor(
    protected readonly request: APIRequestContext,
    private readonly token?: string,
    private readonly cleanup?: Cleanup,
  ) {}

  /** Agenda a remoção de algo criado pelo teste. A remoção não conta para a cobertura. */
  protected registerCleanup(description: string, run: () => Promise<ApiResponse>) {
    this.cleanup?.add(description, run);
  }

  protected get<T>(route: string, options?: Omit<RequestOptions, 'body'>) {
    return this.send<T>('GET', route, options);
  }

  protected post<T>(route: string, options?: RequestOptions) {
    return this.send<T>('POST', route, options);
  }

  protected put<T>(route: string, options?: RequestOptions) {
    return this.send<T>('PUT', route, options);
  }

  protected patch<T>(route: string, options?: RequestOptions) {
    return this.send<T>('PATCH', route, options);
  }

  protected delete<T>(route: string, options?: RequestOptions) {
    return this.send<T>('DELETE', route, options);
  }

  private async send<T>(method: HttpMethod, route: string, options: RequestOptions = {}) {
    // Sem a barra inicial: com ela, o Playwright descartaria o /api/v1 da baseURL
    const template = route.replace(/^\/+/, '');
    const call = () =>
      this.request.fetch(fillPathParams(template, options.path), {
        method,
        params: withoutUndefined(options.query),
        data: options.body,
        headers: {
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
          ...options.headers,
        },
      });

    let response = await call();
    for (let attempt = 1; response.status() === 429 && this.retryOnRateLimit && attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      const seconds = rateLimitWaitSeconds(response);
      noteRateLimitWait(`${method} ${template} → 429: aguardando ${seconds}s (tentativa ${attempt}/${MAX_RATE_LIMIT_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
      response = await call();
    }

    // Só a resposta final conta para a cobertura (um 429 que foi repetido não era o alvo do teste)
    recordApiCall(method, template, response.status());
    return new ApiResponse<T>(response, response.status(), await parseBody(response));
  }
}

/**
 * Quantas vezes repetir depois de um 429. Duas, porque outro teste rodando em paralelo
 * pode consumir o limite de novo logo depois que a janela reabre.
 */
const MAX_RATE_LIMIT_RETRIES = 2;

/** Tempo de espera informado pela própria API (em segundos). */
function rateLimitWaitSeconds(response: APIResponse): number {
  const headers = response.headers();
  const seconds = Number(headers['retry-after'] ?? headers['x-ratelimit-reset']);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) : 60;
}

/** Deixa registrado (terminal + relatório do Playwright) que o teste esperou pelo limite da API. */
function noteRateLimitWait(description: string) {
  console.log(`  [limite da API] ${description}`);
  currentTestInfo()?.annotations.push({ type: 'limite-de-requisicoes', description });
}

function currentTestInfo() {
  try {
    return test.info();
  } catch {
    return undefined; // fora de um teste (ex.: global setup)
  }
}

function fillPathParams(template: string, params: RequestOptions['path'] = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Faltou o parâmetro de rota "${name}" para "${template}"`);
    }
    return encodeURIComponent(String(value));
  });
}

function withoutUndefined(query: RequestOptions['query'] = {}) {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );
}

async function parseBody(response: APIResponse): Promise<unknown> {
  const contentType = response.headers()['content-type'] ?? '';
  if (!contentType.includes('json')) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

let coveragePaused = 0;

/**
 * Executa chamadas que NÃO contam para a cobertura: preparação de dados e limpeza.
 * Ex.: um teste de GET clients/{id} precisa criar um cliente antes, mas não está testando o POST.
 */
export async function withoutCoverage<T>(action: () => Promise<T>): Promise<T> {
  coveragePaused++;
  try {
    return await action();
  } finally {
    coveragePaused--;
  }
}

/** Anota a chamada no teste em execução. Fora de um teste (ex.: global setup) não faz nada. */
function recordApiCall(method: HttpMethod, path: string, status: number) {
  if (coveragePaused > 0) return;
  currentTestInfo()?.annotations.push({ type: API_CALL_ANNOTATION, description: formatApiCall({ method, path, status }) });
}
