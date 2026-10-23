import fs from 'node:fs';
import path from 'node:path';

/** Uma operação (método + rota) documentada no Swagger. */
export interface Operation {
  /** Módulo = primeira tag da operação no Swagger. Ex.: "clients" */
  module: string;
  method: string;
  /** Rota sem o prefixo da API. Ex.: "clients/{id}" */
  path: string;
  summary?: string;
  documentedStatuses: number[];
}

interface OpenApiDocument {
  paths: Record<string, Record<string, { tags?: string[]; summary?: string; responses?: Record<string, unknown> }>>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Baixa o Swagger atualizado e guarda uma cópia local.
 * Se a API estiver fora do ar, usa a última cópia para o relatório não deixar de ser gerado.
 */
export async function loadOpenApi(url: string, cacheFile: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const document = (await response.json()) as OpenApiDocument;
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(document));
    return { document, fromCache: false };
  } catch (error) {
    if (!fs.existsSync(cacheFile)) {
      throw new Error(`Não foi possível baixar o Swagger (${url}) e não existe cópia local: ${error}`);
    }
    const document = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as OpenApiDocument;
    return { document, fromCache: true };
  }
}

/**
 * Lista as operações do Swagger, removendo o prefixo da API das rotas
 * ("/api/v1/clients/{id}" → "clients/{id}") para casar com as rotas usadas nos clients.
 */
export function extractOperations(document: OpenApiDocument, apiBasePath: string): Operation[] {
  const prefix = apiBasePath.replace(/^\/+|\/+$/g, '');
  const operations: Operation[] = [];

  for (const [rawPath, pathItem] of Object.entries(document.paths)) {
    let route = rawPath.replace(/^\/+/, '');
    if (prefix && route.startsWith(`${prefix}/`)) route = route.slice(prefix.length + 1);

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      operations.push({
        module: operation.tags?.[0] ?? 'sem-modulo',
        method: method.toUpperCase(),
        path: route,
        summary: operation.summary,
        documentedStatuses: Object.keys(operation.responses ?? {})
          .map(Number)
          .filter(Number.isInteger)
          .sort((a, b) => a - b),
      });
    }
  }
  return operations;
}
