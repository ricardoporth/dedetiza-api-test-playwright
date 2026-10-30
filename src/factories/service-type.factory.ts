import { fakerPT_BR as faker } from '@faker-js/faker';
import type { CreateMaterialRequest } from '@api/clients/materials.client';
import type { CreateServiceTypeRequest } from '@api/clients/service-types.client';
import { qaName, uniqueSuffix } from './test-data';

const SERVICES = [
  'Dedetização residencial',
  'Dedetização comercial',
  'Desratização',
  'Descupinização',
  'Sanitização de ambientes',
  'Limpeza de caixa d’água',
  'Controle de pombos',
];

/** Código interno único (máximo da API: 50 caracteres). Ex.: "QA-lx3k9a2b" */
export function uniqueInternalCode(): string {
  return `QA-${uniqueSuffix()}`.toUpperCase();
}

/** Tipo de serviço válido e único, só com o obrigatório. Sobrescreva só o campo que o teste quer variar. */
export function buildServiceType(overrides: Partial<CreateServiceTypeRequest> = {}): CreateServiceTypeRequest {
  return {
    name: qaName(`${faker.helpers.arrayElement(SERVICES)} ${uniqueSuffix()}`),
    ...overrides,
  };
}

/** Tipo de serviço com todos os campos opcionais preenchidos (exceto materiais, que dependem de cadastro). */
export function buildFullServiceType(overrides: Partial<CreateServiceTypeRequest> = {}): CreateServiceTypeRequest {
  return buildServiceType({
    internalCode: uniqueInternalCode(),
    description: faker.lorem.sentence(),
    serviceGuaranteeMonths: faker.number.int({ min: 1, max: 24 }),
    documentationGuaranteeMonths: faker.number.int({ min: 1, max: 12 }),
    status: 'active',
    requiresCertificate: true,
    active: true,
    ...overrides,
  });
}

/** Material ativo e único, usado como material sugerido de um tipo de serviço. */
export function buildMaterial(overrides: Partial<CreateMaterialRequest> = {}): CreateMaterialRequest {
  return {
    name: qaName(`Inseticida ${uniqueSuffix()}`),
    unit: 'L',
    category: 'poison',
    stockQuantity: 10,
    minStock: 1,
    ...overrides,
  };
}
