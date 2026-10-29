import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { env } from '@config/env';
import { withoutCoverage } from '@api/base.client';
import { UsersClient } from '@api/clients/users.client';
import { userSchema } from '@schemas/user.schema';
import { decodeJwtPayload, tamperSignature } from '@utils/jwt';

test.describe('GET /users/{id} — 200 sucesso', () => {
  test('deve retornar o usuário pelo id @smoke', async ({ usersClient, adminToken }) => {
    // Arrange: o id do admin está dentro do próprio token (campo "sub")
    const { sub: adminId } = decodeJwtPayload(adminToken);

    // Act
    const response = await usersClient.getById(adminId);

    // Assert
    expect(response.status).toBe(200);
    expect(response).toMatchContract(userSchema);
    expect(response.data.id).toBe(adminId);
    expect(response.data.email).toBe(env.ADMIN_EMAIL);
  });

  test('deve devolver os mesmos dados que GET /users/me', async ({ usersClient, adminToken }) => {
    const { sub: adminId } = decodeJwtPayload(adminToken);
    const me = await withoutCoverage(() => usersClient.me());

    const response = await usersClient.getById(adminId);

    expect(response.status).toBe(200);
    expect(response.data).toEqual(me.data);
  });

  test('todos os usuários do tenant devem seguir o contrato', async ({ usersClient }) => {
    // Contrato testado com usuários DIFERENTES (técnico, vendedor, gerente...):
    // campos que vêm vazios no admin aparecem preenchidos em outros perfis.
    const list = await withoutCoverage(() => usersClient.list({ limit: 100 }));
    expect(list.data.items.length).toBeGreaterThan(1);

    for (const user of list.data.items) {
      const response = await usersClient.getById(user.id);

      expect.soft(response.status, `usuário ${user.name}`).toBe(200);
      expect.soft(response, `usuário ${user.name}`).toMatchContract(userSchema);
    }
  });

  test('deve aceitar o id em letras maiúsculas', async ({ usersClient, adminToken }) => {
    const { sub: adminId } = decodeJwtPayload(adminToken);

    const response = await usersClient.getById(adminId.toUpperCase());

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(adminId);
  });
});

test.describe('GET /users/{id} — 404 não encontrado', () => {
  const notFoundCases = [
    { scenario: 'UUID que não existe', id: () => randomUUID() },
    { scenario: 'UUID nulo (só zeros)', id: () => '00000000-0000-0000-0000-000000000000' },
    // Um id válido de OUTRA entidade não pode devolver dados de usuário
    { scenario: 'id de um perfil (role), não de usuário', id: (token: string) => decodeJwtPayload(token).roleId },
  ];

  for (const { scenario, id } of notFoundCases) {
    test(`deve retornar 404 para ${scenario}`, async ({ usersClient, adminToken }) => {
      const response = await usersClient.getById(id(adminToken));

      expect(response.status).toBe(404);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Usuário não encontrado');
    });
  }
});

test.describe('GET /users/{id} — 400 id inválido (robustez: nunca 500)', () => {
  /**
   * Entradas malformadas e maliciosas. A API deve recusar com 400 — e principalmente
   * NUNCA responder 500, que indicaria que a entrada chegou a quebrar algo no servidor.
   */
  const malformedIds = [
    { scenario: 'texto qualquer', id: 'abc' },
    { scenario: 'número', id: '123' },
    { scenario: 'UUID sem hífens', id: '4e1929ce39bb4966a9aacfd5cdfb7b63' },
    { scenario: 'a palavra "null"', id: 'null' },
    { scenario: 'espaço em branco', id: ' ' },
    { scenario: 'tentativa de SQL injection', id: "1' OR '1'='1" },
    { scenario: 'aspas e caracteres especiais', id: `'"<>;` },
    { scenario: 'caracteres unicode e emoji', id: 'çãé😀' },
    { scenario: 'texto com 5.000 caracteres', id: 'a'.repeat(5000) },
  ];

  for (const { scenario, id } of malformedIds) {
    test(`deve retornar 400 para ${scenario}`, async ({ usersClient }) => {
      const response = await usersClient.getById(id);

      expect(response.status, 'a API não pode quebrar (5xx) com entrada malformada').toBeLessThan(500);
      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe('Validation failed (uuid is expected)');
    });
  }
});

test.describe('GET /users/{id} — 401 não autenticado', () => {
  test('deve exigir token', async ({ request, adminToken }) => {
    const anonymous = new UsersClient(request);

    const response = await anonymous.getById(decodeJwtPayload(adminToken).sub);

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });

  test('deve recusar token com assinatura adulterada', async ({ request, adminToken }) => {
    const withTamperedToken = new UsersClient(request, tamperSignature(adminToken));

    const response = await withTamperedToken.getById(decodeJwtPayload(adminToken).sub);

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });
});

test.describe('GET /users/{id} — 403 sem permissão', () => {
  test('deve recusar usuário sem a permissão users:read', {
    annotation: {
      type: 'regra',
      description: 'RN-USR-003: consultar um usuário pelo id exige a permissão users:read (403)',
    },
  }, async ({ request, adminToken, noPermissionToken }) => {
    const withoutPermission = new UsersClient(request, noPermissionToken);

    const response = await withoutPermission.getById(decodeJwtPayload(adminToken).sub);

    expect(response.status).toBe(403);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Permissão insuficiente');
  });

  test('o usuário sem permissão continua podendo consultar a si mesmo em /users/me', {
    annotation: {
      type: 'regra',
      description: 'RN-USR-004: GET /users/me não exige permissão — todo usuário autenticado vê os próprios dados',
    },
  }, async ({ request, noPermissionToken }) => {
    const withoutPermission = new UsersClient(request, noPermissionToken);

    const response = await withoutPermission.me();

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(decodeJwtPayload(noPermissionToken).sub);
  });
});

test.describe('GET /users/{id} — 429 limite de requisições', () => {
  /**
   * A rota aceita 100 requisições por minuto, e o contador é POR ROTA e compartilhado
   * (vale para todos os usuários da mesma origem). Estourar o limite bloqueia esta rota
   * por até 60s — inclusive para os outros testes. Por isso este teste só roda sob demanda:
   *   npm run test:rate-limit
   */
  test.skip(!process.env.RUN_RATE_LIMIT_TESTS, 'Teste que bloqueia a rota por 60s. Rode com: npm run test:rate-limit');

  test('deve responder 429 ao passar de 100 requisições por minuto @rate-limit', {
    annotation: {
      type: 'regra',
      description: 'RN-USR-005: GET /users/{id} aceita no máximo 100 requisições por minuto (429)',
    },
  }, async ({ usersClient, adminToken }) => {
    // Aqui queremos VER o 429: desliga a espera automática do client
    usersClient.retryOnRateLimit = false;
    const { sub: adminId } = decodeJwtPayload(adminToken);
    const first = await usersClient.getById(adminId);
    expect(first.header('x-ratelimit-limit')).toBe('100');
    const remaining = Number(first.header('x-ratelimit-remaining'));

    // Dispara exatamente o necessário para estourar o limite
    const burst = await Promise.all(
      Array.from({ length: remaining + 1 }, () => usersClient.getById(adminId)),
    );

    const blocked = burst.find((response) => response.status === 429);
    expect(blocked, 'nenhuma requisição recebeu 429').toBeDefined();
    expect(blocked!).toMatchErrorContract();
    expect(Number(blocked!.header('x-ratelimit-reset') ?? blocked!.header('retry-after'))).toBeGreaterThan(0);
  });
});
