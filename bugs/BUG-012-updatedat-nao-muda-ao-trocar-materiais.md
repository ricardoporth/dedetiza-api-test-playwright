---
id: BUG-012
titulo: Trocar só os materiais sugeridos não atualiza o updatedAt do tipo de serviço
modulo: service-types
rotas: PATCH /service-types/{id}
severidade: Baixa
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
corrigido_em:
clickup:
teste: tests/service-types/service-types.update.spec.ts › trocar os materiais sugeridos deve atualizar o updatedAt
---

# BUG-012 — `updatedAt` não muda ao trocar os materiais sugeridos

## Descrição
Um `PATCH` que altera só `suggestedMaterials` grava a nova lista (o retorno já traz os materiais novos), mas o
`updatedAt` do tipo de serviço continua com o valor anterior. Qualquer outra alteração (nome, descrição,
status) atualiza o `updatedAt` normalmente.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Cadastrar um tipo de serviço e anotar o `updatedAt`.
3. Enviar:

```bash
curl -X PATCH "https://api-dedetiza.gladiai.com/api/v1/service-types/<id>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"suggestedMaterials":[{"materialId":"<id de um material ativo>","quantity":1}]}'
```

## Resultado esperado
`updatedAt` posterior ao do passo 2.

## Resultado obtido
`suggestedMaterials` alterado, `updatedAt` idêntico ao anterior.

## Evidências (30/10/2026)
| Alteração no `PATCH` | `updatedAt` muda? |
|---|---|
| `name`, `description` | sim |
| `status` | sim |
| só `suggestedMaterials` (incluir ou trocar) | **não** |
| só `suggestedMaterials: []` (remover todos) | **não** |

## Impacto
- Telas e sincronizações que usam `updatedAt` para saber se precisam recarregar ("alterado desde…") não
  percebem a mudança dos materiais sugeridos, e o levantamento técnico pode ser pré-preenchido com a lista antiga.
- Auditoria: a alteração não aparece como alteração do tipo de serviço.

## Abrangência
- Confirmado em: `PATCH /service-types/{id}`.

## Sugestão de correção
Atualizar o `updatedAt` do tipo de serviço na mesma transação que substitui os materiais sugeridos.

## Teste automatizado
`tests/service-types/service-types.update.spec.ts` → "trocar os materiais sugeridos deve atualizar o updatedAt"
Encontrado pela heurística de contrato "toda alteração atualiza o updatedAt". Hoje marcado como falha
esperada (`test.fail()`).
