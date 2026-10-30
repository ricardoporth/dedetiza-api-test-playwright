---
id: BUG-013
titulo: O filtro por nome trata "_" e "%" como curingas do SQL (LIKE sem escape)
modulo: service-types
rotas: GET /service-types
severidade: Baixa
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
corrigido_em:
clickup:
teste: tests/service-types/service-types.read.spec.ts › "_" e "%" no filtro devem ser tratados como texto, não como curinga
---

# BUG-013 — Filtro por nome interpreta `_` e `%`

## Descrição
O filtro `name` da listagem faz busca parcial, mas não escapa os caracteres especiais do `LIKE`:
`_` casa com qualquer caractere e `%` com qualquer texto. Buscar por `%` devolve todos os tipos de serviço.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Ter um tipo de serviço chamado `Controle abc123`.
3. Enviar:

```bash
curl "https://api-dedetiza.gladiai.com/api/v1/service-types?name=abc_23" -H "Authorization: Bearer <token>"
```

## Resultado esperado
Nenhum resultado: nenhum nome contém o texto `abc_23`.

## Resultado obtido
`Controle abc123` aparece na lista (o `_` casou com o `1`).

## Evidências (30/10/2026)
| Filtro `name` | Resultado |
|---|---|
| `%` | todos os tipos de serviço (`total` igual à listagem sem filtro) |
| sufixo do nome com um caractere trocado por `_` | encontra o tipo de serviço |

## Impacto
Baixo: a busca traz resultados a mais para quem digita `_` ou `%` (ex.: códigos como `SERV_RES`). Não há
risco de injeção de SQL — o valor vai como parâmetro —, só o significado dos curingas.

## Abrangência
- Confirmado em: `GET /service-types?name=`.
- Não verificado em: `GET /service-types?internalCode=` (também faz busca parcial) e nos filtros de nome de
  outros módulos.

## Sugestão de correção
Escapar `\`, `%` e `_` no valor antes de montar o `LIKE`/`ILIKE` (ex.: `ILIKE :name ESCAPE '\'`).

## Teste automatizado
`tests/service-types/service-types.read.spec.ts` → "\"_\" e \"%\" no filtro devem ser tratados como texto, não como curinga"
Hoje marcado como falha esperada (`test.fail()`).
