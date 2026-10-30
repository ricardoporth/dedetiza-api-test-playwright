import { test, expect } from '@fixtures';
import { buildFullVehicle, buildVehicle, generateMercosulPlate, generateOldPlate, lunchTimeAsReturned } from '@factories/vehicle.factory';
import { vehicleSchema } from '@schemas/vehicle.schema';

const PLATE_FORMAT_MESSAGE = 'Placa deve estar no formato Mercosul (ABC1D23) ou antigo (ABC1234)';
const LUNCH_INTERVAL_MESSAGE = 'O intervalo padrão de almoço deve ter início e fim válidos';

test.describe('POST /vehicles — 201 criado (caminho feliz)', () => {
  test('deve criar veículo com os campos obrigatórios @smoke', async ({ vehiclesClient }) => {
    // Arrange
    const payload = buildVehicle();

    // Act
    const response = await vehiclesClient.create(payload);

    // Assert
    expect(response.status).toBe(201);
    expect(response).toMatchContract(vehicleSchema);
    expect(response.data).toMatchObject({
      plate: payload.plate,
      model: payload.model,
      year: payload.year,
      active: true,
      defaultLunchStart: null,
      defaultLunchEnd: null,
    });
  });

  test('deve criar veículo com o horário de almoço padrão', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.create(buildFullVehicle({ defaultLunchStart: '11:30', defaultLunchEnd: '12:45' }));

    expect(response.status).toBe(201);
    expect(response).toMatchContract(vehicleSchema);
    expect(response.data.defaultLunchStart).toBe(lunchTimeAsReturned('11:30'));
    expect(response.data.defaultLunchEnd).toBe(lunchTimeAsReturned('12:45'));
  });

  test('deve aceitar placa no formato antigo (ABC1234)', async ({ vehiclesClient }) => {
    const plate = generateOldPlate();

    const response = await vehiclesClient.create(buildVehicle({ plate }));

    expect(response.status).toBe(201);
    expect(response.data.plate).toBe(plate);
  });

  test('deve permitir cadastrar o veículo já desativado', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.create(buildVehicle({ active: false }));

    expect(response.status).toBe(201);
    expect(response.data.active).toBe(false);
  });

  /** Análise de valor limite: o próprio limite é aceito (o "logo além" está nos testes de 400). */
  const acceptedBoundaries = [
    { scenario: 'ano 1900 (mínimo)', override: { year: 1900 } },
    { scenario: 'ano 2100 (máximo)', override: { year: 2100 } },
    { scenario: 'modelo com 100 caracteres (máximo)', override: { model: `[QA-AUTO] ${'m'.repeat(90)}` } },
    { scenario: 'almoço da meia-noite à 00:01', override: { defaultLunchStart: '00:00', defaultLunchEnd: '00:01' } },
    { scenario: 'almoço das 23:58 às 23:59', override: { defaultLunchStart: '23:58', defaultLunchEnd: '23:59' } },
  ];

  for (const { scenario, override } of acceptedBoundaries) {
    test(`deve aceitar ${scenario}`, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.create(buildVehicle(override));

      expect(response.status).toBe(201);
      expect(response).toMatchContract(vehicleSchema);
    });
  }
});

test.describe('POST /vehicles — 409 placa duplicada', () => {
  test('não deve permitir placa já cadastrada', {
    annotation: { type: 'regra', description: 'RN-VEI-001: a placa é única no tenant (409)' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const existing = await createVehicle();

    const response = await vehiclesClient.create(buildVehicle({ plate: existing.plate }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
    expect(response.errorMessage).toBe('Placa já cadastrada neste tenant');
  });

  test('placa de veículo desativado continua bloqueada', {
    annotation: { type: 'regra', description: 'RN-VEI-002: desativar o veículo não libera a placa para um novo cadastro (409)' },
  }, async ({ vehiclesClient, createVehicle }) => {
    const inactive = await createVehicle(undefined, { active: false });

    const response = await vehiclesClient.create(buildVehicle({ plate: inactive.plate }));

    expect(response.status).toBe(409);
    expect(response).toMatchErrorContract();
  });
});

test.describe('POST /vehicles — 400 placa inválida', () => {
  /**
   * Partição de equivalência: cada linha representa uma CLASSE de placa inválida.
   * A regra documentada é "Mercosul (ABC1D23) ou antigo (ABC1234)", em maiúsculas.
   */
  const invalidPlates = [
    { scenario: 'em letras minúsculas', plate: () => generateMercosulPlate().toLowerCase() },
    { scenario: 'com hífen (ABC-1234)', plate: () => generateOldPlate().replace(/^(...)/, '$1-') },
    { scenario: 'com espaços nas pontas', plate: () => ` ${generateMercosulPlate()} ` },
    { scenario: 'só números', plate: () => '1234567' },
    { scenario: 'só letras', plate: () => 'ABCDEFG' },
    { scenario: 'com 6 caracteres', plate: () => 'ABC123' },
    { scenario: 'com 8 caracteres', plate: () => 'ABC12345' },
    { scenario: 'com emoji', plate: () => 'ABC1D2😀' },
    { scenario: 'vazia', plate: () => '' },
  ];

  for (const { scenario, plate } of invalidPlates) {
    test(`deve recusar placa ${scenario}`, {
      annotation: { type: 'regra', description: 'RN-VEI-003: a placa segue o formato Mercosul (ABC1D23) ou antigo (ABC1234), em maiúsculas' },
    }, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.create(buildVehicle({ plate: plate() }));

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(PLATE_FORMAT_MESSAGE);
    });
  }
});

test.describe('POST /vehicles — 400 demais campos', () => {
  /** Nulos, vazios, tipos errados e valores logo além dos limites documentados. */
  const invalidCases: { scenario: string; fields: Record<string, unknown>; expected: string }[] = [
    { scenario: 'placa nula', fields: { plate: null }, expected: 'plate should not be empty' },
    { scenario: 'modelo vazio', fields: { model: '' }, expected: 'model should not be empty' },
    { scenario: 'modelo nulo', fields: { model: null }, expected: 'model should not be empty' },
    { scenario: 'modelo numérico', fields: { model: 123 }, expected: 'model must be a string' },
    { scenario: 'modelo com 101 caracteres', fields: { model: `[QA-AUTO] ${'m'.repeat(91)}` }, expected: 'model must be shorter than or equal to 100 characters' },
    { scenario: 'ano 1899', fields: { year: 1899 }, expected: 'year must not be less than 1900' },
    { scenario: 'ano 2101', fields: { year: 2101 }, expected: 'year must not be greater than 2100' },
    { scenario: 'ano decimal (2023.5)', fields: { year: 2023.5 }, expected: 'year must be an integer number' },
    { scenario: 'ano como texto ("2023")', fields: { year: '2023' }, expected: 'year must be an integer number' },
    { scenario: 'ano nulo', fields: { year: null }, expected: 'year must be an integer number' },
    { scenario: 'active como texto ("true")', fields: { active: 'true' }, expected: 'active must be a boolean value' },
    { scenario: 'campo "isAdmin"', fields: { isAdmin: true }, expected: 'property isAdmin should not exist' },
    { scenario: 'campo "tenantId" (outro tenant)', fields: { tenantId: '00000000-0000-0000-0000-000000000000' }, expected: 'property tenantId should not exist' },
  ];

  for (const { scenario, fields, expected } of invalidCases) {
    test(`deve recusar ${scenario}`, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.create({ ...buildVehicle(), ...fields });

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContain(expected);
    });
  }

  /** O horário é "HH:mm" de 00:00 a 23:59. Qualquer outra forma de escrever um horário é recusada. */
  const invalidTimes = ['25:00', '12:60', '1200', '12h', '12:00:30', '2026-01-01T12:00:00Z', '9:00'];

  for (const time of invalidTimes) {
    test(`deve recusar horário de almoço "${time}"`, {
      annotation: { type: 'regra', description: 'RN-VEI-004: o horário de almoço usa o formato HH:mm (00:00 a 23:59)' },
    }, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.create(buildVehicle({ defaultLunchStart: time, defaultLunchEnd: '23:59' }));

      expect(response.status).toBe(400);
      expect(response).toMatchErrorContract();
      expect(response.errorMessages).toContainEqual(expect.stringContaining('defaultLunchStart must match'));
    });
  }

  test('deve recusar corpo vazio listando os campos obrigatórios', async ({ vehiclesClient }) => {
    const response = await vehiclesClient.create({});

    expect(response.status).toBe(400);
    expect(response).toMatchErrorContract();
    expect(response.errorMessages).toEqual(
      expect.arrayContaining(['plate should not be empty', 'model should not be empty', 'year must be an integer number']),
    );
  });

  test('deve recusar modelo só com espaços', {
    annotation: { type: 'bug', description: 'BUG-014: modelo do veículo só com espaços ("   ") é aceito' },
  }, async ({ vehiclesClient }) => {
    // Bug conhecido: hoje a API responde 201. Relatório: bugs/BUG-014-modelo-de-veiculo-so-com-espacos.md
    test.fail();

    const response = await vehiclesClient.create(buildVehicle({ model: '   ' }));

    expect(response.status).toBe(400);
  });
});

test.describe('POST /vehicles — intervalo de almoço', () => {
  const invalidIntervals = [
    { scenario: 'início depois do fim', lunch: { defaultLunchStart: '14:00', defaultLunchEnd: '13:00' } },
    { scenario: 'início igual ao fim', lunch: { defaultLunchStart: '12:00', defaultLunchEnd: '12:00' } },
    { scenario: 'só o início', lunch: { defaultLunchStart: '12:00' } },
    { scenario: 'só o fim', lunch: { defaultLunchEnd: '13:00' } },
  ];

  for (const { scenario, lunch } of invalidIntervals) {
    test(`deve recusar almoço com ${scenario}`, {
      annotation: {
        type: 'regra',
        description: 'RN-VEI-005: o almoço padrão tem início E fim, e o início vem antes do fim',
      },
    }, async ({ vehiclesClient }) => {
      const response = await vehiclesClient.create(buildVehicle(lunch));

      // A regra é recusar. O status (hoje 409, deveria ser 400) é verificado no teste do BUG-016.
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(response).toMatchErrorContract();
      expect(response.errorMessage).toBe(LUNCH_INTERVAL_MESSAGE);
    });
  }

  test('intervalo de almoço inválido deve responder 400 (erro de validação), não 409', {
    annotation: {
      type: 'bug',
      description: 'BUG-016: intervalo de almoço inválido responde 409 Conflict em vez de 400 Bad Request',
    },
  }, async ({ vehiclesClient }) => {
    // Bug conhecido: hoje a API responde 409. Relatório: bugs/BUG-016-almoco-invalido-responde-409.md
    test.fail();

    const response = await vehiclesClient.create(buildVehicle({ defaultLunchStart: '14:00', defaultLunchEnd: '13:00' }));

    expect(response.status).toBe(400);
  });
});
