import { z } from 'zod';
import { id, paginated, timestamp } from './common.schema';

/** Contratos do módulo vehicles, escritos a partir das respostas reais da API e do VehicleResponseDto. */

/** Mercosul (ABC1D23) ou antigo (ABC1234): 3 letras, 1 dígito, letra OU dígito, 2 dígitos — sempre maiúsculas. */
export const PLATE_PATTERN = /^[A-Z]{3}\d[A-Z\d]\d{2}$/;

/**
 * Horário de almoço: a API recebe "HH:mm" e devolve a coluna "time" serializada como data em 1970-01-01 (UTC).
 * Ex.: enviado "12:00" → recebido "1970-01-01T12:00:00.000Z"
 */
const lunchTime = z
  .string()
  .regex(/^1970-01-01T([01]\d|2[0-3]):[0-5]\d:00\.000Z$/, 'horário serializado como 1970-01-01THH:mm:00.000Z')
  .nullable();

export const vehicleSchema = z.strictObject({
  id,
  tenantId: id,
  plate: z.string().regex(PLATE_PATTERN, 'placa no formato Mercosul (ABC1D23) ou antigo (ABC1234)'),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100),
  active: z.boolean(),
  defaultLunchStart: lunchTime,
  defaultLunchEnd: lunchTime,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const vehicleListSchema = paginated(vehicleSchema);

/** O tipo TypeScript nasce do schema: uma única fonte de verdade. */
export type VehicleData = z.infer<typeof vehicleSchema>;
