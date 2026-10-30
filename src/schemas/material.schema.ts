import { z } from 'zod';
import { id, paginated, timestamp } from './common.schema';

/**
 * Contrato de um material de estoque, escrito a partir das respostas reais da API.
 * Os valores decimais vêm serializados como texto (ex.: "49.9", "12.5"), não como número.
 */
const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'decimal serializado como texto, ex.: "12.5"');

export const materialSchema = z.strictObject({
  id,
  tenantId: id,
  name: z.string().min(1).max(255),
  unit: z.enum(['un', 'kg', 'g', 'L', 'ml']),
  category: z.enum(['poison', 'cleaningProduct', 'protectiveEquipment', 'other']),
  billable: z.boolean(),
  unitCost: decimalString,
  stockQuantity: decimalString,
  minStock: decimalString,
  minStockAlert: z.boolean(),
  active: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const materialListSchema = paginated(materialSchema);

/** O tipo TypeScript nasce do schema: uma única fonte de verdade. */
export type MaterialData = z.infer<typeof materialSchema>;
