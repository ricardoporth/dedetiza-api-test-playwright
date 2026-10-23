/**
 * Tipos de anotação que o relatório de cobertura entende.
 *
 *  - api-call: registrada automaticamente pelo BaseClient a cada requisição
 *  - regra:    regra de negócio descoberta, declarada no teste
 *  - bug:      bug conhecido, declarado no teste (normalmente junto com test.fail())
 */
export const API_CALL_ANNOTATION = 'api-call';
export const RULE_ANNOTATION = 'regra';
export const BUG_ANNOTATION = 'bug';

export interface ApiCall {
  method: string;
  /** Rota no formato do Swagger, sem o prefixo /api/v1. Ex.: "clients/{id}" */
  path: string;
  status: number;
}

/** "POST clients/{id} → 201" — legível no relatório do Playwright e fácil de converter de volta. */
export function formatApiCall({ method, path, status }: ApiCall): string {
  return `${method} ${path} → ${status}`;
}

export function parseApiCall(description: string): ApiCall | undefined {
  const match = /^([A-Z]+) (\S+) → (\d{3})$/.exec(description);
  if (!match) return undefined;
  const [, method, path, status] = match;
  return { method: method!, path: path!, status: Number(status) };
}
