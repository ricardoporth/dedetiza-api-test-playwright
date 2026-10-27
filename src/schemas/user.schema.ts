import { z } from 'zod';
import { id, timestamp } from './common.schema';

/**
 * Contrato de um usuário, escrito a partir da resposta real de GET /users/me.
 * Campos marcados com "só observado null" ainda não foram vistos preenchidos:
 * quando o módulo users for testado por completo, confirme o tipo deles.
 */
export const userSchema = z.strictObject({
  id,
  name: z.string().min(1),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  rg: z.string().nullable(),
  cnh: z.string().nullable(),
  cnhValidity: z.string().nullable(), // só observado null
  phone: z.string().nullable(),
  email: z.email(),
  photoUrl: z.string().nullable(),
  profile: z.string().min(1),
  maxTechnicalDifficultyLevel: z.string().min(1), // observado: "high"
  responsible: z.string().nullable(), // só observado null
  active: z.boolean(),
  emergencyContactPhone: z.string().nullable(),
  lastAccessAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type UserData = z.infer<typeof userSchema>;
