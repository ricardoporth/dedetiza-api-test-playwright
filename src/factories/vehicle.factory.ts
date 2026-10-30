import { fakerPT_BR as faker } from '@faker-js/faker';
import type { CreateVehicleRequest } from '@api/clients/vehicles.client';
import { qaName } from './test-data';

const MODELS = ['Fiat Strada', 'Fiat Fiorino', 'Renault Kangoo', 'VW Saveiro', 'Chevrolet Montana', 'Peugeot Partner'];

const letters = (count: number) => faker.string.alpha({ length: count, casing: 'upper' });
const digits = (count: number) => faker.string.numeric(count);

/** Placa no formato Mercosul. Ex.: "QNF6S62" — 26³·10·26·10² ≈ 456 milhões de combinações. */
export function generateMercosulPlate(): string {
  return `${letters(3)}${digits(1)}${letters(1)}${digits(2)}`;
}

/** Placa no formato antigo. Ex.: "PUB1661" */
export function generateOldPlate(): string {
  return `${letters(3)}${digits(4)}`;
}

/** Veículo válido e único, só com o obrigatório. O "[QA-AUTO]" vai no modelo (a placa tem formato fixo). */
export function buildVehicle(overrides: Partial<CreateVehicleRequest> = {}): CreateVehicleRequest {
  return {
    plate: generateMercosulPlate(),
    model: qaName(faker.helpers.arrayElement(MODELS)),
    year: faker.number.int({ min: 2010, max: 2026 }),
    ...overrides,
  };
}

/** Veículo com todos os campos opcionais preenchidos. */
export function buildFullVehicle(overrides: Partial<CreateVehicleRequest> = {}): CreateVehicleRequest {
  return buildVehicle({ active: true, defaultLunchStart: '12:00', defaultLunchEnd: '13:00', ...overrides });
}

/** "12:00" → "1970-01-01T12:00:00.000Z": como a API devolve um horário enviado. */
export function lunchTimeAsReturned(hhmm: string): string {
  return `1970-01-01T${hhmm}:00.000Z`;
}
