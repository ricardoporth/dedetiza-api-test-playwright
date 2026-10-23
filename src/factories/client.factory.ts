import { fakerPT_BR as faker } from '@faker-js/faker';
import type {
  AddressRequest,
  CreateClientRequest,
  PhoneRequest,
  PjRequest,
} from '@api/clients/clients.client';
import { generateCnpj, generateCpf } from '@utils/documents';
import { qaEmail, qaName } from './test-data';

/**
 * Endereços REAIS: a API geocodifica o endereço (busca latitude/longitude) ao salvar.
 * Endereço inventado pelo Faker poderia não ser encontrado e gerar falsos erros.
 */
const REAL_ADDRESSES: AddressRequest[] = [
  { zipcode: '01001000', street: 'Praca da Se', number: '1', neighborhood: 'Se', city: 'Sao Paulo', state: 'SP' },
  { zipcode: '01310200', street: 'Avenida Paulista', number: '1578', neighborhood: 'Bela Vista', city: 'Sao Paulo', state: 'SP' },
  { zipcode: '04538133', street: 'Avenida Brigadeiro Faria Lima', number: '3477', neighborhood: 'Itaim Bibi', city: 'Sao Paulo', state: 'SP' },
];

/** Celular principal com WhatsApp — a API exige exatamente 1 telefone principal. */
export function buildPhone(overrides: Partial<PhoneRequest> = {}): PhoneRequest {
  return {
    number: `119${faker.string.numeric(8)}`,
    type: 'celular_whatsapp',
    isPrimary: true,
    ...overrides,
  };
}

export function buildAddress(overrides: Partial<AddressRequest> = {}): AddressRequest {
  return {
    label: 'Principal',
    ...faker.helpers.arrayElement(REAL_ADDRESSES),
    isPrimary: true,
    ...overrides,
  };
}

export function buildPj(overrides: Partial<PjRequest> = {}): PjRequest {
  const company = faker.company.name();
  return {
    cnpj: generateCnpj(),
    legalName: `${company} Ltda`,
    tradeName: company,
    ieIndicator: 'isento',
    ...overrides,
  };
}

/** Cliente pessoa física válido e único. Sobrescreva só o campo que o teste quer variar. */
export function buildClientPF(overrides: Partial<CreateClientRequest> = {}): CreateClientRequest {
  return {
    personType: 'PF',
    name: qaName(faker.person.fullName()),
    email: qaEmail(),
    phones: [buildPhone()],
    pf: { cpf: generateCpf() },
    ...overrides,
  };
}

/** Cliente pessoa jurídica válido e único. */
export function buildClientPJ(overrides: Partial<CreateClientRequest> = {}): CreateClientRequest {
  return {
    personType: 'PJ',
    name: qaName(faker.company.name()),
    email: qaEmail(),
    phones: [buildPhone()],
    pj: buildPj(),
    ...overrides,
  };
}
