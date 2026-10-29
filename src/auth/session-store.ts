import fs from 'node:fs';
import path from 'node:path';
import type { LoginData } from '@api/clients/auth.client';
import { decodeJwtPayload } from '@utils/jwt';

/** Sessão salva pelo projeto "setup" e lida pelos testes. */
export interface Session {
  accessToken: string;
  expiresAt: string;
  user: LoginData['user'];
}

/** .auth/ fica na raiz do projeto e está no .gitignore — token é credencial. */
export const ADMIN_SESSION_FILE = path.resolve(__dirname, '../../.auth/admin.json');
export const NO_PERMISSION_SESSION_FILE = path.resolve(__dirname, '../../.auth/no-permission.json');

/** Margem de segurança: um token que expira em menos de 30 min não é reaproveitado. */
const EXPIRATION_MARGIN_MS = 30 * 60 * 1000;

export function readSession(file: string): Session | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Session;
  } catch {
    return undefined;
  }
}

export function saveSession(file: string, data: LoginData): Session {
  const session: Session = {
    accessToken: data.accessToken,
    expiresAt: new Date(decodeJwtPayload(data.accessToken).exp * 1000).toISOString(),
    user: data.user,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(session, null, 2));
  return session;
}

/**
 * A sessão salva pode ser reaproveitada?
 * Além de não estar perto de expirar, precisa ser do mesmo usuário e tenant do .env —
 * se você trocar o .env, o token antigo não serve mais.
 */
export function isSessionReusable(session: Session, expected: { email: string; tenantId: string }): boolean {
  const stillValid = new Date(session.expiresAt).getTime() - Date.now() > EXPIRATION_MARGIN_MS;
  return stillValid && session.user.email === expected.email && session.user.tenantId === expected.tenantId;
}
