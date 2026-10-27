import { z } from 'zod';
import { id } from './common.schema';

/** Resposta do login. */
export const loginSchema = z.strictObject({
  /** JWT: header.payload.assinatura */
  accessToken: z.jwt(),
  /** Duração do token. Ex.: "8h" */
  expiresIn: z.string().regex(/^\d+[smhd]$/, 'formato esperado: número + s/m/h/d (ex.: 8h)'),
  user: z.strictObject({
    id,
    name: z.string().min(1),
    email: z.email(),
    tenantId: id,
    roleId: id,
  }),
});

export type LoginData = z.infer<typeof loginSchema>;
