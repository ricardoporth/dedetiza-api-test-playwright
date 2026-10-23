import { fakerPT_BR as faker } from '@faker-js/faker';

/**
 * Prefixo de todo dado criado pelos testes. O ambiente de dev é compartilhado:
 * o prefixo deixa claro o que é massa de teste e permite achar/limpar sobras.
 */
export const QA_PREFIX = '[QA-AUTO]';

export function qaName(base: string): string {
  return `${QA_PREFIX} ${base}`;
}

/** Sufixo curto e único por chamada. Ex.: "lx3k9a2b" */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${faker.string.alphanumeric({ length: 4, casing: 'lower' })}`;
}

/** E-mail único em domínio reservado para exemplos (nunca entrega para ninguém). */
export function qaEmail(): string {
  return `qa.auto.${uniqueSuffix()}@example.com`;
}
