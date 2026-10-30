import { randomBytes } from 'node:crypto';
import { fakerPT_BR as faker } from '@faker-js/faker';
import type { CreateUserRequest } from '@api/clients/users.client';
import { generateCpf } from '@utils/documents';
import { qaEmail, qaName } from './test-data';

/** Senha forte e diferente a cada chamada (entre 8 e 128 caracteres, como a API exige). */
export function buildPassword(): string {
  return `Qa#${randomBytes(9).toString('base64url')}`;
}

/**
 * Usuário válido e único. O perfil (roleId) é obrigatório: nos testes, use o perfil
 * "[QA-AUTO] Sem permissões" — se a limpeza falhar, sobra um usuário que não consegue fazer nada.
 */
export function buildUser(roleId: string, overrides: Partial<CreateUserRequest> = {}): CreateUserRequest {
  const password = overrides.password ?? buildPassword();
  return {
    roleId,
    name: qaName(faker.person.fullName()),
    cpf: generateCpf(),
    email: qaEmail(),
    password,
    confirmPassword: password,
    ...overrides,
  };
}
