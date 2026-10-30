import type { ApiResponse, ErrorBody, Paginated } from '@api/api-response';
import type { ServiceTypeData } from '@schemas/service-type.schema';
import type { VehicleData } from '@schemas/vehicle.schema';

/**
 * Heurísticas de contrato: regras que um schema (Zod) não consegue expressar sozinho, porque
 * dependem de MAIS DE UM campo, de outra resposta ou do contexto da chamada. Ex.:
 *   - "status" e "active" precisam dizer a mesma coisa
 *   - updatedAt não pode ser anterior a createdAt, nem estar no futuro
 *   - a página não pode trazer mais itens que o "limit" pedido
 *   - um erro nunca pode vazar stack trace ou SQL
 *
 * Cada função devolve a LISTA de violações encontradas (vazia = tudo certo). No teste:
 *   expect(serviceTypeHeuristics(data, { tenantId })).toEqual([]);
 * Assim, quando falha, o relatório mostra todas as violações de uma vez, em português.
 */

/** Tolerância entre o relógio da máquina dos testes e o do servidor. */
const CLOCK_SKEW_MS = 5 * 60_000;
/** Nenhum registro deste sistema pode ser anterior a isso — data menor indica fuso/serialização errados. */
const OLDEST_PLAUSIBLE_DATE = Date.parse('2020-01-01T00:00:00Z');

interface Timestamps {
  createdAt: string;
  updatedAt?: string;
}

/** createdAt ≤ updatedAt, nenhuma data no futuro e nenhuma data absurda no passado. */
export function timestampHeuristics(entity: Timestamps, label = 'registro'): string[] {
  const problems: string[] = [];
  const now = Date.now();
  const created = Date.parse(entity.createdAt);
  const dates: [string, number][] = [['createdAt', created]];
  if (entity.updatedAt !== undefined) {
    const updated = Date.parse(entity.updatedAt);
    dates.push(['updatedAt', updated]);
    if (updated < created) problems.push(`${label}: updatedAt (${entity.updatedAt}) é anterior a createdAt (${entity.createdAt})`);
  }
  for (const [field, value] of dates) {
    if (value > now + CLOCK_SKEW_MS) problems.push(`${label}: ${field} está no futuro (${new Date(value).toISOString()})`);
    if (value < OLDEST_PLAUSIBLE_DATE) problems.push(`${label}: ${field} implausível (${new Date(value).toISOString()})`);
  }
  return problems;
}

/**
 * Regras de um tipo de serviço que dependem de mais de um campo:
 *  - pertence ao tenant de quem consultou
 *  - "status" e "active" são duas formas de dizer a mesma coisa e não podem divergir
 *  - cada material sugerido aponta para ESTE tipo, traz o material certo e do mesmo tenant
 *  - quantidade sugerida é positiva; a lista vem em ordem de createdAt (documentado) e sem material repetido
 */
export function serviceTypeHeuristics(serviceType: ServiceTypeData, { tenantId }: { tenantId: string }): string[] {
  const label = `tipo de serviço ${serviceType.id}`;
  const problems = timestampHeuristics(serviceType, label);

  if (serviceType.tenantId !== tenantId) problems.push(`${label}: tenantId ${serviceType.tenantId} não é o tenant da sessão (${tenantId})`);
  if ((serviceType.status === 'active') !== serviceType.active) {
    problems.push(`${label}: status "${serviceType.status}" contradiz active=${serviceType.active}`);
  }

  const materials = serviceType.suggestedMaterials;
  const seen = new Set<string>();
  materials.forEach((suggested, index) => {
    const where = `${label} › suggestedMaterials[${index}]`;
    if (suggested.serviceTypeId !== serviceType.id) problems.push(`${where}: serviceTypeId aponta para outro tipo (${suggested.serviceTypeId})`);
    if (suggested.material.id !== suggested.materialId) problems.push(`${where}: material.id (${suggested.material.id}) ≠ materialId (${suggested.materialId})`);
    if (suggested.material.tenantId !== tenantId) problems.push(`${where}: material de outro tenant (${suggested.material.tenantId})`);
    if (!(Number(suggested.quantity) > 0)) problems.push(`${where}: quantidade não positiva ("${suggested.quantity}")`);
    if (seen.has(suggested.materialId)) problems.push(`${where}: material ${suggested.materialId} repetido na lista`);
    seen.add(suggested.materialId);
    if (Date.parse(suggested.createdAt) < Date.parse(serviceType.createdAt)) {
      problems.push(`${where}: createdAt anterior ao do próprio tipo de serviço`);
    }
    const previous = materials[index - 1];
    if (previous && Date.parse(suggested.createdAt) < Date.parse(previous.createdAt)) {
      problems.push(`${where}: fora da ordem documentada (createdAt ascendente)`);
    }
    problems.push(...timestampHeuristics(suggested, where));
  });
  return problems;
}

/**
 * Regras de um veículo que dependem de mais de um campo:
 *  - pertence ao tenant de quem consultou
 *  - o almoço padrão vem completo (início E fim) ou vazio (os dois null) — nunca pela metade
 *  - quando existe, o início do almoço vem antes do fim
 *  - o ano não é posterior ao ano que vem (veículo "do futuro" indica erro de digitação ou de conversão)
 */
export function vehicleHeuristics(vehicle: VehicleData, { tenantId }: { tenantId: string }): string[] {
  const label = `veículo ${vehicle.plate} (${vehicle.id})`;
  const problems = timestampHeuristics(vehicle, label);

  if (vehicle.tenantId !== tenantId) problems.push(`${label}: tenantId ${vehicle.tenantId} não é o tenant da sessão (${tenantId})`);

  const { defaultLunchStart: start, defaultLunchEnd: end } = vehicle;
  if ((start === null) !== (end === null)) {
    problems.push(`${label}: almoço pela metade (início ${start}, fim ${end})`);
  } else if (start !== null && end !== null && Date.parse(start) >= Date.parse(end)) {
    problems.push(`${label}: início do almoço (${start}) não é anterior ao fim (${end})`);
  }

  const nextYear = new Date().getUTCFullYear() + 1;
  if (vehicle.year > nextYear) problems.push(`${label}: ano ${vehicle.year} é posterior a ${nextYear}`);
  return problems;
}

/** Coerência da página com o que foi pedido. Só regras que não dependem de outros testes rodando em paralelo. */
export function paginationHeuristics(
  data: Paginated<{ id: string }>,
  requested: { page: number; limit: number },
): string[] {
  const problems: string[] = [];
  const { items, total, page, limit } = data;
  if (page !== requested.page) problems.push(`page devolvida (${page}) ≠ pedida (${requested.page})`);
  if (limit !== requested.limit) problems.push(`limit devolvido (${limit}) ≠ pedido (${requested.limit})`);
  if (items.length > limit) problems.push(`a página trouxe ${items.length} itens, mais que o limit (${limit})`);
  const offset = (page - 1) * limit;
  if (items.length && total < offset + items.length) {
    problems.push(`total (${total}) menor que os itens já percorridos (${offset + items.length})`);
  }
  if (offset >= total && items.length) problems.push(`página além do total (${total}) não veio vazia`);
  const ids = items.map((item) => item.id);
  const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (repeated.length) problems.push(`itens repetidos na mesma página: ${[...new Set(repeated)].join(', ')}`);
  return problems;
}

/** Sinais de detalhe interno vazando para o cliente: stack trace, SQL, ORM, caminho de arquivo. */
const INTERNAL_LEAK = /\bat \S+ \(|node_modules|\.ts:\d+|\.js:\d+|prisma|typeorm|sequelize|QueryFailed|\bSELECT\b.+\bFROM\b|\bINSERT INTO\b|\bUPDATE\b.+\bSET\b|duplicate key|violates|ECONNREFUSED|stack/i;

/**
 * Heurísticas de uma resposta de erro, além do formato (toMatchErrorContract):
 *  - "path" é a rota que foi chamada (com a query string, como a API devolve)
 *  - "timestamp" é de agora
 *  - a mensagem não vaza detalhe interno (stack, SQL, ORM)
 *  - 5xx tem mensagem genérica
 */
export function errorHeuristics(response: ApiResponse): string[] {
  const problems: string[] = [];
  const body = response.body as Partial<ErrorBody> | null;
  if (!body || typeof body !== 'object') return [`corpo de erro ausente (HTTP ${response.status})`];

  const url = new URL(response.raw.url());
  const calledPath = safeDecode(url.pathname + url.search);
  if (body.path !== undefined && safeDecode(body.path) !== calledPath) {
    problems.push(`path do erro ("${body.path}") ≠ rota chamada ("${calledPath}")`);
  }
  const at = Date.parse(body.timestamp ?? '');
  if (!(Math.abs(Date.now() - at) <= CLOCK_SKEW_MS)) problems.push(`timestamp do erro fora do horário atual (${body.timestamp})`);

  for (const message of [body.message ?? ''].flat()) {
    if (INTERNAL_LEAK.test(message)) problems.push(`mensagem vaza detalhe interno: "${message.slice(0, 200)}"`);
    if (!message.trim()) problems.push('mensagem de erro vazia');
  }
  if (response.status >= 500 && body.message !== 'Internal server error') {
    problems.push(`erro 5xx com mensagem não genérica: "${String(body.message).slice(0, 200)}"`);
  }
  return problems;
}

/** Headers que toda resposta da API deve ter (formato e proteções básicas de segurança). */
export function responseHeaderHeuristics(response: ApiResponse): string[] {
  const problems: string[] = [];
  const contentType = response.header('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) problems.push(`content-type não é JSON ("${contentType}")`);
  if (!/charset=utf-8/i.test(contentType)) problems.push(`content-type sem charset=utf-8 ("${contentType}")`);
  if (response.header('x-content-type-options') !== 'nosniff') problems.push('falta x-content-type-options: nosniff');
  if (!response.header('strict-transport-security')) problems.push('falta strict-transport-security (HSTS)');
  if (response.header('x-powered-by')) problems.push(`x-powered-by expõe a tecnologia do servidor ("${response.header('x-powered-by')}")`);
  const limit = response.header('x-ratelimit-limit');
  if (limit !== undefined && !(Number(limit) > 0)) problems.push(`x-ratelimit-limit inválido ("${limit}")`);
  return problems;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
