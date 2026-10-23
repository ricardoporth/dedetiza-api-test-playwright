/**
 * Um JWT tem três partes separadas por ponto: header.payload.assinatura
 * O payload é só Base64 — qualquer um consegue LER. A assinatura é o que impede ALTERAR.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roleId: string;
  /** Emitido em (segundos desde 1970) */
  iat: number;
  /** Expira em (segundos desde 1970) */
  exp: number;
}

export function decodeJwtPayload(token: string): JwtPayload {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Token JWT em formato inválido');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload;
}

/** Devolve o mesmo token com a assinatura alterada — usado para testar se a API recusa tokens adulterados. */
export function tamperSignature(token: string): string {
  const [header, payload, signature = ''] = token.split('.');
  const lastChar = signature.slice(-1) === 'A' ? 'B' : 'A';
  return `${header}.${payload}.${signature.slice(0, -1)}${lastChar}`;
}
