import type { VehicleData } from '@schemas/vehicle.schema';
import type { Paginated } from '../api-response';
import { BaseClient } from '../base.client';

export type { VehicleData };

// ---------- O que enviamos ----------

export interface CreateVehicleRequest {
  /** Mercosul (ABC1D23) ou antigo (ABC1234), em maiúsculas */
  plate: string;
  /** 1 a 100 caracteres */
  model: string;
  /** Inteiro de 1900 a 2100 */
  year: number;
  active?: boolean | null;
  /** "HH:mm". Início e fim vão juntos, e o início vem antes do fim */
  defaultLunchStart?: string | null;
  defaultLunchEnd?: string | null;
}

export type UpdateVehicleRequest = Partial<{ [K in keyof CreateVehicleRequest]: CreateVehicleRequest[K] | null }>;

export interface VehicleFilters {
  page?: number;
  limit?: number;
  /** Busca parcial, sem diferenciar maiúsculas */
  plate?: string;
  active?: boolean;
  /** ISO 8601. Os dois vão juntos: só veículos disponíveis no intervalo */
  availableStart?: string;
  availableEnd?: string;
}

/**
 * Veículos da frota do tenant. Todo veículo criado com sucesso é desativado automaticamente
 * ao final do teste (o DELETE da API é soft delete).
 */
export class VehiclesClient extends BaseClient {
  /** "Record<string, unknown>" permite enviar corpos inválidos (tipos errados, campos extras) nos testes. */
  async create(payload: Partial<CreateVehicleRequest> | Record<string, unknown>) {
    const response = await this.post<VehicleData>('vehicles', { body: payload });
    if (response.status === 201) {
      const { id } = response.data;
      this.registerCleanup(`desativar veículo ${id}`, () => this.deactivate(id));
    }
    return response;
  }

  list(filters: VehicleFilters | Record<string, string | number | boolean | undefined> = {}) {
    return this.get<Paginated<VehicleData>>('vehicles', { query: { ...filters } });
  }

  getById(id: string) {
    return this.get<VehicleData>('vehicles/{id}', { path: { id } });
  }

  update(id: string, payload: UpdateVehicleRequest | Record<string, unknown> | unknown[]) {
    return this.patch<VehicleData>('vehicles/{id}', { path: { id }, body: payload });
  }

  /** Soft delete: o veículo fica com active=false e continua consultável. */
  deactivate(id: string) {
    return this.delete<VehicleData>('vehicles/{id}', { path: { id } });
  }
}
