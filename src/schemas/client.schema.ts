import { z } from 'zod';
import { id, paginated, timestamp } from './common.schema';

/** Contratos do módulo clients, escritos a partir das respostas reais da API. */

export const phoneSchema = z.strictObject({
  id,
  number: z.string().min(1).max(20),
  type: z.enum(['residencial', 'comercial', 'celular_sem_whatsapp', 'celular_whatsapp']),
  additionalInfo: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const addressSchema = z.strictObject({
  id,
  clientId: id,
  label: z.string().nullable(),
  zipcode: z.string().nullable(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  complement: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().length(2).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  formattedAddress: z.string().nullable(),
  geocodingSource: z.string().nullable(),
  geocodedAt: timestamp.nullable(),
  isPrimary: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const pfSchema = z.strictObject({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  rg: z.string().nullable(),
});

const pjSchema = z.strictObject({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
  legalName: z.string(),
  tradeName: z.string().nullable(),
  ie: z.string().nullable(),
  im: z.string().nullable(),
  ufIndicator: z.string().nullable(),
  segment: z.string().nullable(),
  responsibleId: id.nullable(),
});

/** Campos que todo cliente tem — também é o formato resumido devolvido pelo DELETE. */
export const clientSummarySchema = z.strictObject({
  id,
  tenantId: id,
  personType: z.enum(['PF', 'PJ']),
  name: z.string().min(1).max(255),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  active: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const clientDetails = {
  phones: z.array(phoneSchema),
  primaryPhone: phoneSchema.nullable(),
  addresses: z.array(addressSchema),
};

/**
 * Cliente completo. O tipo de pessoa decide qual bloco vem preenchido:
 *   PF → "pf" preenchido e "pj" null
 *   PJ → "pj" preenchido e "pf" null
 */
export const clientSchema = z.discriminatedUnion('personType', [
  clientSummarySchema.extend({ ...clientDetails, personType: z.literal('PF'), pf: pfSchema, pj: z.null() }),
  clientSummarySchema.extend({ ...clientDetails, personType: z.literal('PJ'), pf: z.null(), pj: pjSchema }),
]);

export const clientListSchema = paginated(clientSchema);

/** Os tipos TypeScript nascem dos schemas: uma única fonte de verdade. */
export type PhoneData = z.infer<typeof phoneSchema>;
export type AddressData = z.infer<typeof addressSchema>;
export type ClientSummaryData = z.infer<typeof clientSummarySchema>;
export type ClientData = z.infer<typeof clientSchema>;
