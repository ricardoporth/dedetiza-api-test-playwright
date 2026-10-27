import type { AddressData, ClientData, ClientSummaryData } from '@schemas/client.schema';
import type { Paginated } from '../api-response';
import { BaseClient } from '../base.client';

export type { AddressData, ClientData, ClientSummaryData };

export type PersonType = 'PF' | 'PJ';
export type PhoneType = 'residencial' | 'comercial' | 'celular_sem_whatsapp' | 'celular_whatsapp';
export type IeIndicator = 'contribuinte' | 'isento' | 'nao_contribuinte';

// ---------- O que enviamos ----------

export interface PhoneRequest {
  number: string;
  type: PhoneType;
  additionalInfo?: string;
  isPrimary?: boolean;
}

export interface AddressRequest {
  label?: string;
  zipcode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  isPrimary?: boolean;
}

export interface PjRequest {
  cnpj: string;
  legalName: string;
  tradeName?: string;
  ieIndicator?: IeIndicator;
  ie?: string;
  im?: string;
  ufIndicator?: string;
  segment?: string;
  responsibleId?: string;
}

export interface CreateClientRequest {
  personType: PersonType;
  name: string;
  email?: string;
  /** Campo legado: vira um telefone principal do tipo celular_sem_whatsapp */
  phone?: string;
  phones?: PhoneRequest[];
  pf?: { cpf: string; rg?: string };
  pj?: PjRequest;
  addresses?: AddressRequest[];
}

/** personType não pode ser alterado depois de criado; endereços têm rotas próprias. */
export type UpdateClientRequest = Partial<Omit<CreateClientRequest, 'personType' | 'addresses'>> & {
  active?: boolean;
};

export interface ClientFilters {
  page?: number;
  limit?: number;
  name?: string;
  personType?: PersonType;
  /** CPF ou CNPJ */
  document?: string;
  active?: boolean;
}

// ---------- O que recebemos ----------
// Os tipos de resposta vêm dos schemas (src/schemas/client.schema.ts): uma única fonte de verdade.

/**
 * Clientes (PF e PJ). Todo cliente criado com sucesso é desativado
 * automaticamente ao final do teste (o DELETE da API é soft delete).
 */
export class ClientsClient extends BaseClient {
  /** Partial<> permite enviar corpos incompletos nos testes de validação. */
  async create(payload: Partial<CreateClientRequest>) {
    const response = await this.post<ClientData>('clients', { body: payload });
    if (response.status === 201) {
      const { id } = response.data;
      this.registerCleanup(`desativar cliente ${id}`, () => this.deactivate(id));
    }
    return response;
  }

  list(filters: ClientFilters = {}) {
    return this.get<Paginated<ClientData>>('clients', { query: { ...filters } });
  }

  getById(id: string) {
    return this.get<ClientData>('clients/{id}', { path: { id } });
  }

  update(id: string, payload: UpdateClientRequest) {
    return this.patch<ClientData>('clients/{id}', { path: { id }, body: payload });
  }

  /** Soft delete: o cliente fica com active=false. Devolve a versão resumida do cliente. */
  deactivate(id: string) {
    return this.delete<ClientSummaryData>('clients/{id}', { path: { id } });
  }

  addAddress(clientId: string, payload: AddressRequest) {
    return this.post<AddressData>('clients/{id}/addresses', { path: { id: clientId }, body: payload });
  }

  updateAddress(clientId: string, addressId: string, payload: AddressRequest) {
    return this.patch<AddressData>('clients/{id}/addresses/{addressId}', {
      path: { id: clientId, addressId },
      body: payload,
    });
  }

  removeAddress(clientId: string, addressId: string) {
    return this.delete('clients/{id}/addresses/{addressId}', { path: { id: clientId, addressId } });
  }
}
