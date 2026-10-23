import type { APIResponse } from '@playwright/test';

/** Envelope que a API usa nas respostas de sucesso. */
export interface SuccessBody<T> {
  statusCode: number;
  message: string;
  data: T;
}

/** Envelope que a API usa nas respostas de erro. */
export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

/** Formato das listagens paginadas da API. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Resposta de uma chamada feita por um client.
 * Guarda o status, o corpo já convertido de JSON e sabe "desembrulhar" o envelope da API.
 */
export class ApiResponse<TData = unknown> {
  constructor(
    /** Resposta original do Playwright (headers, corpo binário etc.) */
    readonly raw: APIResponse,
    readonly status: number,
    /** Corpo convertido de JSON, ou null quando a resposta não é JSON */
    readonly body: unknown,
  ) {}

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  /**
   * Conteúdo de "data" de uma resposta de sucesso.
   * Se a resposta for um erro, falha com uma mensagem que mostra o que a API devolveu,
   * em vez do genérico "Cannot read properties of undefined".
   */
  get data(): TData {
    if (!this.ok || !isSuccessBody(this.body)) {
      throw new Error(
        `Esperava uma resposta de sucesso com "data", mas recebeu HTTP ${this.status}: ${preview(this.body)}`,
      );
    }
    return this.body.data as TData;
  }

  /** Mensagem de uma resposta de erro: um texto, ou uma lista quando são erros de validação. */
  get errorMessage(): string | string[] {
    if (this.ok || !isErrorBody(this.body)) {
      throw new Error(
        `Esperava uma resposta de erro, mas recebeu HTTP ${this.status}: ${preview(this.body)}`,
      );
    }
    return this.body.message;
  }

  /** Mensagem de erro sempre como lista — prático para usar com toContain(). */
  get errorMessages(): string[] {
    return [this.errorMessage].flat();
  }

  header(name: string): string | undefined {
    return this.raw.headers()[name.toLowerCase()];
  }
}

function isSuccessBody(body: unknown): body is SuccessBody<unknown> {
  return typeof body === 'object' && body !== null && 'data' in body;
}

function isErrorBody(body: unknown): body is ErrorBody {
  return typeof body === 'object' && body !== null && 'message' in body && 'statusCode' in body;
}

function preview(body: unknown): string {
  const text = JSON.stringify(body) ?? String(body);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}
