import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { withoutCoverage } from '@api/base.client';
import { UsersClient, type CreateUserRequest } from '@api/clients/users.client';
import { NO_PERMISSION_IDENTITY } from '@auth/test-identities';
import { buildUser } from '@factories/user.factory';
import { userSchema } from '@schemas/user.schema';
import { formatCpf, generateCpf, withWrongCheckDigit } from '@utils/documents';

test.describe('POST /users — 201 criado', () => {
  test('deve criar usuário com os campos obrigatórios @smoke', async ({ usersClient, qaRoleId }) => {
    // Arrange
    const payload = buildUser(qaRoleId);

    // Act
    const response = await usersClient.create(payload);

    // Assert
    expect(response.status).toBe(201);
    expect(response).toMatchContract(userSchema);
    expect(response.data).toMatchObject({
      name: payload.name,
      cpf: payload.cpf,
      email: payload.email,
      profile: NO_PERMISSION_IDENTITY.roleName,
      active: true,
    });
  });

  test('não deve devolver a senha na resposta', {
    annotation: { type: 'regra', description: 'RN-USR-006: a resposta do cadastro nunca expõe senha ou hash' },
  }, async ({ usersClient, qaRoleId }) => {
    const response = await usersClient.create(buildUser(qaRoleId));

    expect(response.status).toBe(201);
    const sensitiveFields = Object.keys(response.data).filter((key) => /password|senha|hash|secret/i.test(key));
    expect(sensitiveFields).toEqual([]);
  });

  test('deve criar usuário com todos os campos opcionais', async ({ usersClient, qaRoleId }) => {
    // O responsável precisa ser um gerente que já existe
    const users = await withoutCoverage(() => usersClient.list({ limit: 100 }));
    const manager = users.data.items.find((user) => /gerente/i.test(user.profile) && user.active);
    expect(manager, 'nenhum gerente ativo no tenant para usar como responsável').toBeDefined();

    const payload = buildUser(qaRoleId, {
      responsibleId: manager!.id,
      rg: '1234567',
      cnh: '12345678901',
      cnhValidity: '31/12/2027',
      phone: '11999990000',
      emergencyContactPhone: '11988887777',
      maxTechnicalDifficultyLevel: 'medium',
    });

    const response = await usersClient.create(payload);

    expect(response.status).toBe(201);
    expect(response).toMatchContract(userSchema);
    expect(response.data).toMatchObject({
      rg: '1234567',
      cnh: '12345678901',
      cnhValidity: '31/12/2027',
      phone: '11999990000',
      emergencyContactPhone: '11988887777',
      maxTechnicalDifficultyLevel: 'medium',
      responsible: { id: manager!.id, name: manager!.name },
    });
  });

  test('deve aceitar senha com exatamente 8 caracteres (limite mínimo)', async ({ usersClient, qaRoleId }) => {
    const response = await usersClient.create(buildUser(qaRoleId, { password: 'Abcd#123', confirmPassword: 'Abcd#123' }));

    expect(response.status).toBe(201);
  });

  test('deve aceitar CPF com máscara e salvar só os dígitos', {
    annotation: {
      type: 'regra',
      description: 'RN-USR-007: o CPF do usuário aceita máscara e é salvo só com dígitos (o cadastro de clientes recusa máscara)',
    },
  }, async ({ usersClient, qaRoleId }) => {
    const cpf = generateCpf();

    const response = await usersClient.create(buildUser(qaRoleId, { cpf: formatCpf(cpf) }));

    expect(response.status).toBe(201);
    expect(response.data.cpf).toBe(cpf);
  });

  test('o usuário criado deve poder ser consultado', async ({ usersClient, qaRoleId }) => {
    const created = await usersClient.create(buildUser(qaRoleId));

    const reloaded = await withoutCoverage(() => usersClient.getById(created.data.id));

    expect(reloaded.status).toBe(200);
    expect(reloaded.data).toEqual(created.data);
  });
});

test.describe('POST /users — 409 duplicidade', () => {
  test('não deve permitir CPF já cadastrado', {
    annotation: { type: 'regra', description: 'RN-USR-008: o CPF do usuário é único no tenant (409)' },
  }, async ({ usersClient, qaRoleId, createUser }) => {
    const existing = await createUser();

    const response = await usersClient.create(buildUser(qaRoleId, { cpf: existing.cpf }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('CPF já cadastrado. Informe um CPF diferente.');
  });

  test('não deve permitir e-mail já cadastrado', {
    annotation: { type: 'regra', description: 'RN-USR-009: o e-mail do usuário é único no tenant (409)' },
  }, async ({ usersClient, qaRoleId, createUser }) => {
    const existing = await createUser();

    const response = await usersClient.create(buildUser(qaRoleId, { email: existing.email! }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('E-mail já cadastrado. Informe um e-mail diferente.');
  });

  test('CPF de usuário desativado continua bloqueado', {
    annotation: { type: 'regra', description: 'RN-USR-010: desativar o usuário não libera o CPF para um novo cadastro (409)' },
  }, async ({ usersClient, qaRoleId, createUser }) => {
    const inactive = await createUser(undefined, { active: false });

    const response = await usersClient.create(buildUser(qaRoleId, { cpf: inactive.cpf }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
  });

  // Testes de regressão do BUG-004 (corrigido em 30/10/2026). Relatório: bugs/BUG-004-email-duplicado-com-maiusculas.md
  const caseInsensitiveEmail = {
    type: 'regra',
    description: 'RN-USR-014: o e-mail não diferencia maiúsculas — é salvo em minúsculas e a duplicidade ignora a caixa (corrigido no BUG-004)',
  };

  test('não deve permitir o mesmo e-mail escrito com letras maiúsculas', { annotation: caseInsensitiveEmail }, async ({ usersClient, qaRoleId, createUser }) => {
    const existing = await createUser();

    const response = await usersClient.create(buildUser(qaRoleId, { email: existing.email!.toUpperCase() }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('E-mail já cadastrado. Informe um e-mail diferente.');
  });

  test('o e-mail é salvo em letras minúsculas', { annotation: caseInsensitiveEmail }, async ({ usersClient, qaRoleId }) => {
    const email = `QA.Auto.${Date.now()}@Example.com`;

    const response = await usersClient.create(buildUser(qaRoleId, { email }));

    expect(response.status).toBe(201);
    expect(response.data.email).toBe(email.toLowerCase());
  });
});

test.describe('POST /users — 404 referência inexistente', () => {
  test('deve recusar perfil (roleId) inexistente', async ({ usersClient }) => {
    const response = await usersClient.create(buildUser(randomUUID()));

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Papel não encontrado neste tenant');
  });

  test('deve recusar responsável (responsibleId) inexistente', async ({ usersClient, qaRoleId }) => {
    const response = await usersClient.create(buildUser(qaRoleId, { responsibleId: randomUUID() }));

    expect(response.status).toBe(404);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Responsável não encontrado neste tenant');
  });
});

test.describe('POST /users — 400 dados inválidos', () => {
  test('perfil de gerente exige e-mail', {
    annotation: { type: 'regra', description: 'RN-USR-011: usuário com perfil de gerente precisa ter e-mail' },
  }, async ({ usersClient, rolesClient }) => {
    const roles = await withoutCoverage(() => rolesClient.list({ limit: 100 }));
    const managerRole = roles.data.items.find((role) => /gerente/i.test(role.name));
    expect(managerRole, 'nenhum perfil de gerente no tenant').toBeDefined();

    const response = await usersClient.create(buildUser(managerRole!.id, { email: undefined }));

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('E-mail é obrigatório para usuário gerente');
  });

  /**
   * Teste orientado a dados: nulos, vazios, tipos errados, limites e campos proibidos.
   * Os valores com tipo errado (null, número) são enviados de propósito — por isso o "as never",
   * que diz ao TypeScript "eu sei que isto não segue o contrato".
   */
  const invalidCases: { scenario: string; override: Partial<CreateUserRequest>; expected: string[] }[] = [
    { scenario: 'nome nulo', override: { name: null as never }, expected: ['name should not be empty', 'name must be a string'] },
    { scenario: 'nome vazio', override: { name: '' }, expected: ['name should not be empty'] },
    { scenario: 'nome numérico', override: { name: 123 as never }, expected: ['name must be a string'] },
    { scenario: 'CPF nulo', override: { cpf: null as never }, expected: ['CPF inválido', 'cpf should not be empty'] },
    { scenario: 'CPF com dígito verificador errado', override: { cpf: withWrongCheckDigit(generateCpf()) }, expected: ['CPF inválido'] },
    { scenario: 'e-mail em formato inválido', override: { email: 'nao-e-um-email' }, expected: ['email must be an email'] },
    { scenario: 'perfil fora do formato UUID', override: { roleId: 'abc' }, expected: ['roleId must be a UUID'] },
    {
      scenario: 'senha com 7 caracteres (abaixo do mínimo)',
      override: { password: 'Abc#123', confirmPassword: 'Abc#123' },
      expected: ['password must be longer than or equal to 8 characters'],
    },
    {
      scenario: 'senha com 129 caracteres (acima do máximo)',
      override: { password: 'a'.repeat(129), confirmPassword: 'a'.repeat(129) },
      expected: ['password must be shorter than or equal to 128 characters'],
    },
    {
      scenario: 'confirmação de senha diferente',
      override: { password: 'SenhaUm#2026', confirmPassword: 'SenhaDois#2026' },
      expected: ['confirmPassword deve ser igual a password'],
    },
    {
      scenario: 'nível técnico fora da lista',
      override: { maxTechnicalDifficultyLevel: 'expert' as never },
      expected: ['maxTechnicalDifficultyLevel must be one of the following values: low, medium, high'],
    },
  ];

  for (const { scenario, override, expected } of invalidCases) {
    test(`deve recusar ${scenario}`, async ({ usersClient, qaRoleId }) => {
      const response = await usersClient.create(buildUser(qaRoleId, override));

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      for (const message of expected) {
        expect(response.errorMessages).toContain(message);
      }
    });
  }

  test('deve recusar corpo vazio listando os campos obrigatórios', async ({ usersClient }) => {
    const response = await usersClient.create({});

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessages).toEqual(
      expect.arrayContaining(['roleId must be a UUID', 'name should not be empty', 'cpf should not be empty']),
    );
  });

  const forbiddenFields = [
    { field: 'isAdmin', value: true, why: 'tentar se promover a administrador' },
    { field: 'tenantId', value: '00000000-0000-0000-0000-000000000000', why: 'tentar criar o usuário em outro tenant' },
  ];

  for (const { field, value, why } of forbiddenFields) {
    test(`deve recusar o campo "${field}" (${why})`, {
      annotation: { type: 'regra', description: 'RN-USR-012: campos fora do contrato são recusados (400), não ignorados' },
    }, async ({ usersClient, qaRoleId }) => {
      const response = await usersClient.create({ ...buildUser(qaRoleId), [field]: value });

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(`property ${field} should not exist`);
    });
  }

  // Teste de regressão do BUG-005 (corrigido em 30/10/2026). Relatório: bugs/BUG-005-nome-so-com-espacos.md
  for (const [scenario, name] of [['espaços', '   '], ['tabs', '\t\t']]) {
    test(`deve recusar nome só com ${scenario}`, {
      annotation: { type: 'regra', description: 'RN-USR-015: nome só com espaços ou tabs é recusado (corrigido no BUG-005)' },
    }, async ({ usersClient, qaRoleId }) => {
      const response = await usersClient.create(buildUser(qaRoleId, { name }));

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain('name should not be empty');
    });
  }
});

test.describe('POST /users — limite de tamanho do nome', () => {
  test('deve aceitar nome com 255 caracteres (limite máximo)', async ({ usersClient, qaRoleId }) => {
    const name = `[QA-AUTO] ${'a'.repeat(245)}`; // 10 + 245 = 255

    const response = await usersClient.create(buildUser(qaRoleId, { name }));

    expect(response.status).toBe(201);
    expect(response.data.name).toBe(name);
  });

  // Teste de regressão do BUG-006 (corrigido em 30/10/2026): antes, 256+ caracteres causava erro 500.
  // Relatório: bugs/BUG-006-nome-longo-causa-erro-500.md
  test('deve recusar nome com 256 caracteres com 400, e não quebrar com 500', {
    annotation: { type: 'regra', description: 'RN-USR-016: o nome do usuário tem no máximo 255 caracteres (corrigido no BUG-006)' },
  }, async ({ usersClient, qaRoleId }) => {
    const response = await usersClient.create(buildUser(qaRoleId, { name: `[QA-AUTO] ${'a'.repeat(246)}` }));

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessages).toContain('name must be shorter than or equal to 255 characters');
  });
});

test.describe('POST /users — robustez (nunca 500)', () => {
  const extremeNames = [
    { scenario: 'nome com emoji e acentos', name: '[QA-AUTO] Ação Ñandú 😀' },
    { scenario: 'nome com tentativa de SQL injection', name: "[QA-AUTO] Robert'); DROP TABLE users;--" },
  ];

  for (const { scenario, name } of extremeNames) {
    test(`não deve quebrar com ${scenario}`, async ({ usersClient, qaRoleId }) => {
      const response = await usersClient.create(buildUser(qaRoleId, { name }));

      // Aceitar (201) ou recusar (400) são respostas válidas. Quebrar (5xx), não.
      expect(response.status, 'a API não pode quebrar (5xx) com entradas extremas').toBeLessThan(500);
      if (response.status === 201) expect(response.data.name).toBe(name);
    });
  }
});

test.describe('POST /users — 401 e 403', () => {
  test('deve exigir token', async ({ request, qaRoleId }) => {
    const response = await new UsersClient(request).create(buildUser(qaRoleId));

    expect(response.status).toBe(401);
    expect(response).toMatchErrorContract();
  });

  test('deve recusar usuário sem a permissão users:create', {
    annotation: { type: 'regra', description: 'RN-USR-013: criar usuário exige a permissão users:create (403)' },
  }, async ({ request, noPermissionToken, qaRoleId, cleanup }) => {
    // Passa o cleanup: se a API aceitasse por engano, o usuário criado seria desativado no fim
    const withoutPermission = new UsersClient(request, noPermissionToken, cleanup);

    const response = await withoutPermission.create(buildUser(qaRoleId));

    expect(response.status).toBe(403);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Permissão insuficiente');
  });
});
