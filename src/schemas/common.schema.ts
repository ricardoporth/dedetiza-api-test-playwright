import { z } from 'zod';

/**
 * Peças de contrato reutilizadas por todos os módulos.
 *
 * Usamos z.strictObject: um campo que NÃO está no contrato faz o teste falhar.
 * Isso é proposital — campo novo pode ser só uma evolução da API (aí atualizamos
 * o schema em um único lugar), mas também pode ser um dado sensível vazando.
 */

/** Identificador no formato UUID. Ex.: "4e1929ce-39bb-4966-9aa9-cfd5cdfb7b63" */
export const id = z.uuid();

/** Data/hora ISO 8601 em UTC. Ex.: "2026-09-23T19:06:04.920Z" */
export const timestamp = z.iso.datetime();

/** Envelope de sucesso: { statusCode, message, data } */
export function successBody<T extends z.ZodType>(data: T) {
  return z.strictObject({
    statusCode: z.number().int(),
    message: z.string(),
    data,
  });
}

/** Envelope de sucesso sem "data" (ex.: algumas remoções) */
export const emptySuccessBody = z.strictObject({
  statusCode: z.number().int(),
  message: z.string(),
});

/** Envelope de erro: { statusCode, message, path, timestamp } */
export const errorBody = z.strictObject({
  statusCode: z.number().int(),
  message: z.union([z.string(), z.array(z.string()).nonempty()]),
  path: z.string().startsWith('/'),
  timestamp,
});

/** Listagem paginada: { items, total, page, limit } */
export function paginated<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  });
}
