import { z } from 'zod';

/** Situação de cada dependência da API (banco, Redis...). */
const dependencies = z.record(
  z.string(),
  z.strictObject({
    status: z.enum(['up', 'down']),
    message: z.string().optional(),
  }),
);

export const healthSchema = z.strictObject({
  status: z.enum(['ok', 'error']),
  info: dependencies.nullable(),
  error: dependencies.nullable(),
  details: dependencies,
});

export type HealthData = z.infer<typeof healthSchema>;
