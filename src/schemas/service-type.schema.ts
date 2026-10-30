import { z } from 'zod';
import { id, paginated, timestamp } from './common.schema';
import { materialSchema } from './material.schema';

/** Contratos do módulo service-types, escritos a partir das respostas reais da API. */

/** Decimal(12,3) serializado como texto: até 9 dígitos inteiros e 3 casas. Ex.: "2.5", "0.001" */
const quantity = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, 'quantidade decimal(12,3) serializada como texto, ex.: "2.5"');

export const suggestedMaterialSchema = z.strictObject({
  id,
  serviceTypeId: id,
  materialId: id,
  quantity,
  createdAt: timestamp,
  /** O material vem completo, para a tela pré-preencher o levantamento técnico sem outra chamada */
  material: materialSchema,
});

export const serviceTypeSchema = z.strictObject({
  id,
  tenantId: id,
  name: z.string().min(1).max(255),
  internalCode: z.string().min(1).max(50).nullable(),
  description: z.string().nullable(),
  serviceGuaranteeMonths: z.number().int().nonnegative().nullable(),
  documentationGuaranteeMonths: z.number().int().nonnegative().nullable(),
  status: z.enum(['active', 'inactive']),
  requiresCertificate: z.boolean(),
  active: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
  /** Documentado: ordenados por createdAt ascendente */
  suggestedMaterials: z.array(suggestedMaterialSchema),
});

export const serviceTypeListSchema = paginated(serviceTypeSchema);

/** Os tipos TypeScript nascem dos schemas: uma única fonte de verdade. */
export type SuggestedMaterialData = z.infer<typeof suggestedMaterialSchema>;
export type ServiceTypeData = z.infer<typeof serviceTypeSchema>;
