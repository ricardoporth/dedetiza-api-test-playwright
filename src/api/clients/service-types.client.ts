import type { ServiceTypeData, SuggestedMaterialData } from '@schemas/service-type.schema';
import type { Paginated } from '../api-response';
import { BaseClient } from '../base.client';

export type { ServiceTypeData, SuggestedMaterialData };

export type ServiceTypeStatus = 'active' | 'inactive';

// ---------- O que enviamos ----------

export interface SuggestedMaterialRequest {
  materialId: string;
  /** Mínimo 0.001, até 3 casas decimais */
  quantity: number;
}

export interface CreateServiceTypeRequest {
  name: string;
  internalCode?: string | null;
  description?: string | null;
  serviceGuaranteeMonths?: number | null;
  documentationGuaranteeMonths?: number | null;
  status?: ServiceTypeStatus | null;
  requiresCertificate?: boolean | null;
  active?: boolean | null;
  suggestedMaterials?: SuggestedMaterialRequest[] | null;
}

/** Todos os campos opcionais. "suggestedMaterials" SUBSTITUI a lista atual. */
export type UpdateServiceTypeRequest = Partial<{ [K in keyof CreateServiceTypeRequest]: CreateServiceTypeRequest[K] | null }>;

export interface ServiceTypeFilters {
  page?: number;
  limit?: number;
  /** Busca parcial, sem diferenciar maiúsculas */
  name?: string;
  internalCode?: string;
  /** Sem filtro: ativos e inativos */
  status?: ServiceTypeStatus | 'all';
  active?: boolean;
}

/**
 * Tipos de serviço do tenant (ex.: "Dedetização residencial"). Todo tipo criado com sucesso é
 * desativado automaticamente ao final do teste (o DELETE da API é soft delete).
 */
export class ServiceTypesClient extends BaseClient {
  /** "unknown" permite enviar corpos inválidos (tipos errados, campos extras) nos testes de validação. */
  async create(payload: Partial<CreateServiceTypeRequest> | Record<string, unknown>) {
    const response = await this.post<ServiceTypeData>('service-types', { body: payload });
    if (response.status === 201) {
      const { id } = response.data;
      this.registerCleanup(`desativar tipo de serviço ${id}`, () => this.deactivate(id));
    }
    return response;
  }

  list(filters: ServiceTypeFilters | Record<string, string | number | boolean | undefined> = {}) {
    return this.get<Paginated<ServiceTypeData>>('service-types', { query: { ...filters } });
  }

  getById(id: string) {
    return this.get<ServiceTypeData>('service-types/{id}', { path: { id } });
  }

  update(id: string, payload: UpdateServiceTypeRequest | Record<string, unknown> | unknown[]) {
    return this.patch<ServiceTypeData>('service-types/{id}', { path: { id }, body: payload });
  }

  /** Soft delete: o tipo fica com status "inactive" e active=false, e continua consultável. */
  deactivate(id: string) {
    return this.delete<ServiceTypeData>('service-types/{id}', { path: { id } });
  }
}
