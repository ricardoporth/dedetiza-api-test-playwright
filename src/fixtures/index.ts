/**
 * Ponto único de importação para os testes:
 *   import { test, expect } from '@fixtures';
 *
 * As fixtures são montadas em camadas, cada uma usando a anterior:
 *   core.fixtures  → adminToken, cleanup
 *   api.fixtures   → um client por módulo (healthClient, clientsClient...)
 *   data.fixtures  → preparação de dados (createClient...)
 *
 * O expect exportado tem as asserções de contrato (toMatchContract, toMatchErrorContract).
 */
export { test } from './data.fixtures';
export { expect } from './matchers';
