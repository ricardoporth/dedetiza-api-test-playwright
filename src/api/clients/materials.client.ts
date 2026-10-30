import type { MaterialData } from '@schemas/material.schema';
import { BaseClient } from '../base.client';

export type { MaterialData };

export interface CreateMaterialRequest {
  name: string;
  unit: MaterialData['unit'];
  category: MaterialData['category'];
  stockQuantity: number;
  minStock: number;
  billable?: boolean;
  unitCost?: number;
  minStockAlert?: boolean;
  active?: boolean;
}

/**
 * Materiais de estoque. Por enquanto só o necessário para preparar dados de outros módulos
 * (ex.: materiais sugeridos de um tipo de serviço). Todo material criado é desativado ao final do teste.
 */
export class MaterialsClient extends BaseClient {
  async create(payload: CreateMaterialRequest) {
    const response = await this.post<MaterialData>('materials', { body: payload });
    if (response.status === 201) {
      const { id } = response.data;
      this.registerCleanup(`desativar material ${id}`, () => this.deactivate(id));
    }
    return response;
  }

  /** Soft delete: o material fica com active=false */
  deactivate(id: string) {
    return this.delete<MaterialData>('materials/{id}', { path: { id } });
  }
}
