import { config } from 'dotenv';
import { z } from 'zod';

// Carrega o arquivo .env para dentro de process.env.
// Variáveis já definidas no sistema (ex.: secrets do CI) têm prioridade sobre o arquivo.
config({ quiet: true });

const envSchema = z.object({
  API_BASE_URL: z
    .url({ error: 'deve ser uma URL válida, ex.: https://api-dedetiza.gladiai.com/api/v1' })
    // Garante a barra final. Sem ela, o Playwright descartaria o "/api/v1"
    // ao montar as URLs das requisições.
    .transform((url) => (url.endsWith('/') ? url : `${url}/`)),
  OPENAPI_URL: z.url({ error: 'deve ser uma URL válida' }),
  TENANT_ID: z.string({ error: 'obrigatório' }).min(1, 'obrigatório'),
  ADMIN_EMAIL: z.email({ error: 'deve ser um e-mail válido' }),
  ADMIN_PASSWORD: z
    .string({ error: 'obrigatório' })
    .min(8, 'a API exige no mínimo 8 caracteres'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Variáveis de ambiente inválidas ou ausentes:\n${problems}\n\n` +
      'Confira o arquivo .env (use o .env.example como modelo).',
  );
}

export const env = parsed.data;
