---
id: BUG-010
titulo: Garantia ou quantidade acima da capacidade do banco derruba a API com HTTP 500
modulo: service-types
rotas: POST /service-types, PATCH /service-types/{id}
severidade: Média
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
corrigido_em:
clickup:
teste: tests/service-types/service-types.contract.spec.ts › POST com serviceGuaranteeMonths 2.147.483.648 não deve causar 500
---

# BUG-010 — Número acima do limite causa erro 500

## Descrição
Os campos numéricos têm só limite mínimo no DTO. Um valor maior que o que a coluna do banco comporta passa
pela validação e falha ao gravar, e a API responde **500 Internal server error** em vez de 400.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/service-types" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Tipo QA","serviceGuaranteeMonths":2147483648}'
```

## Resultado esperado
HTTP **400** com uma mensagem como `"serviceGuaranteeMonths must not be greater than 120"` (ou o limite de
negócio que fizer sentido).

## Resultado obtido
```json
{ "statusCode": 500, "message": "Internal server error", "path": "/api/v1/service-types" }
```

## Evidências (30/10/2026)
| Campo | Valor | Status |
|---|---|---|
| `serviceGuaranteeMonths` | 1.200 (100 anos) | 201 — aceito, sem limite de negócio |
| `serviceGuaranteeMonths` | 2.147.483.647 (maior int de 32 bits) | 201 |
| `serviceGuaranteeMonths` | **2.147.483.648** | **500** |
| `documentationGuaranteeMonths` | **2.147.483.648** | **500** |
| `serviceGuaranteeMonths` | **1e20** | **500** |
| `serviceGuaranteeMonths` no `PATCH` | **2.147.483.648** | **500** |
| `suggestedMaterials[].quantity` | 999.999.999,999 (máximo de decimal(12,3)) | 201 |
| `suggestedMaterials[].quantity` | **1.000.000.000** | **500** |

## Impacto
- Erro 500 aparece como "erro inesperado" para o usuário, sem dizer o que corrigir, e pode disparar alertas
  de monitoramento.
- Garantia de 2 bilhões de meses (ou de 100 anos) é aceita: não há limite de negócio.

## Abrangência
- Confirmado em: `POST /service-types` e `PATCH /service-types/{id}`.
- Não verificado em: materiais (`stockQuantity`, `unitCost`) e materiais de serviços/levantamentos, que
  usam decimais parecidos.
- Relacionado: BUG-006 (texto acima do limite da coluna causa 500).

## Sugestão de correção
Adicionar `@Max()` aos campos de garantia (com um limite de negócio, ex.: 120 meses) e à quantidade
(`999999999.999`), e documentar o `maximum` no Swagger.

## Teste automatizado
`tests/service-types/service-types.contract.spec.ts` → bloco "heurística de robustez (fronteiras do Swagger: 4xx, nunca 500)".
As linhas marcadas com BUG-010 estão como falha esperada (`test.fail()`); as linhas no limite
(2.147.483.647 e 999.999.999,999) garantem que a correção não vai recusar valores válidos.
