import { z } from 'zod';
import { id, timestamp } from './common.schema';

/** Identificador de permissão no formato "modulo:acao". Ex.: "clients:create" */
const slug = z.string().regex(/^[\w-]+:[\w-]+$/, 'formato esperado: modulo:acao');

/** Uma permissão do catálogo (GET /permissions). */
export const permissionSchema = z.strictObject({
  id,
  slug,
  module: z.string().min(1),
  description: z.string().min(1),
  createdAt: timestamp,
});

export const permissionListSchema = z.array(permissionSchema);

/** Permissões do usuário logado (GET /permissions/me): só os slugs. */
export const myPermissionsSchema = z.array(slug);

export type PermissionData = z.infer<typeof permissionSchema>;
