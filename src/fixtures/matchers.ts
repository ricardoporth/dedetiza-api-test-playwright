import { expect as base } from '@playwright/test';
import { z } from 'zod';
import type { ApiResponse } from '@api/api-response';
import { emptySuccessBody, errorBody, successBody } from '@schemas/common.schema';

/**
 * Asserções customizadas de contrato:
 *
 *   expect(response).toMatchContract(roleSchema)   // envelope de sucesso + "data" no formato do schema
 *   expect(response).toMatchContract()             // envelope de sucesso SEM "data" (ex.: algumas remoções)
 *   expect(response).toMatchErrorContract()        // envelope de erro padrão da API
 *
 * Quando falham, mostram exatamente QUAL campo está fora do contrato e por quê.
 */
export const expect = base.extend({
  toMatchContract(response: ApiResponse, dataSchema?: z.ZodType) {
    const contract = dataSchema ? successBody(dataSchema) : emptySuccessBody;
    const result = contract.safeParse(response.body);
    return {
      name: 'toMatchContract',
      pass: result.success,
      message: () =>
        result.success
          ? 'Esperava que a resposta NÃO seguisse o contrato, mas seguiu.'
          : `A resposta (HTTP ${response.status}) não segue o contrato:\n\n${z.prettifyError(result.error)}`,
    };
  },

  toMatchErrorContract(response: ApiResponse) {
    const result = errorBody.safeParse(response.body);
    const problems: string[] = [];
    if (!result.success) problems.push(z.prettifyError(result.error));
    else if (result.data.statusCode !== response.status) {
      problems.push(`statusCode do corpo (${result.data.statusCode}) diferente do status HTTP (${response.status})`);
    }
    return {
      name: 'toMatchErrorContract',
      pass: problems.length === 0,
      message: () =>
        problems.length === 0
          ? 'Esperava que a resposta NÃO seguisse o contrato de erro, mas seguiu.'
          : `A resposta (HTTP ${response.status}) não segue o contrato de erro:\n\n${problems.join('\n')}`,
    };
  },
});
