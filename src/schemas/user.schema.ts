import { z } from 'zod';
import { id, timestamp } from './common.schema';

/**
 * Contrato de um usuário, escrito a partir das respostas reais de GET /users/me e GET /users/{id}.
 * Campos marcados com "só observado null" ainda não foram vistos preenchidos:
 * quando aparecerem preenchidos, o teste de contrato avisa e o tipo é confirmado aqui.
 */
export const userSchema = z.strictObject({
  id,
  name: z.string().min(1),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  rg: z.string().nullable(),
  cnh: z.string().nullable(), // só observado null
  cnhValidity: z.string().nullable(), // só observado null (Swagger: "31/12/2027")
  phone: z.string().nullable(),
  email: z.email().nullable(),
  photoUrl: z.string().nullable(),
  /** Nome do perfil (role) do usuário */
  profile: z.string().min(1),
  /** Swagger: low=1, medium=2, high=3 */
  maxTechnicalDifficultyLevel: z.enum(['low', 'medium', 'high']),
  /** Gerente responsável pelo usuário */
  responsible: z.strictObject({ id, name: z.string().min(1) }).nullable(),
  active: z.boolean(),
  emergencyContactPhone: z.string().nullable(),
  lastAccessAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type UserData = z.infer<typeof userSchema>;
