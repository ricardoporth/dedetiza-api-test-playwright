import { z } from 'zod';
import { id, paginated, timestamp } from './common.schema';

/** Contrato de um perfil de acesso, escrito a partir das respostas reais da API. */
export const roleSchema = z.strictObject({
  id,
  tenantId: id,
  name: z.string().min(1).max(100),
  description: z.string().max(255).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const roleListSchema = paginated(roleSchema);

/** O tipo TypeScript nasce do schema: uma única fonte de verdade. */
export type RoleData = z.infer<typeof roleSchema>;
