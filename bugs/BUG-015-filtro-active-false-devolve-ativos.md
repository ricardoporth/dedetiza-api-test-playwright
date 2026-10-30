---
id: BUG-015

titulo: BUG-API - GET /vehicles - Filtro active=false devolve veículos ATIVOS
modulo: vehicles
rotas: GET /vehicles
severidade: Média
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
teste: tests/vehicles/vehicles.read.spec.ts › active=false deve trazer só veículos inativos
---

# BUG-API — Filtro active=false devolve veículos ATIVOS

## Descrição
O filtro `active` da listagem de veículos trata qualquer valor como "verdadeiro". `active=true`,
`active=false` e até `active=abc` devolvem exatamente o mesmo resultado: só os veículos **ativos**. Não há
como listar apenas os veículos inativos.

## Passos para reproduzir
1. Autenticar e obter um token.
2. Ter pelo menos um veículo desativado (`DELETE /vehicles/{id}`).
3. Enviar:

```bash
curl "https://api-dedetiza.gladiai.com/api/v1/vehicles?active=false" \
  -H "Authorization: Bearer <token>"
```

> Nunca coloque um token real no relatório.

## Resultado esperado
- `active=false`: só veículos com `"active": false`.
- `active=abc`: HTTP **400**, porque o valor não é booleano.

## Resultado obtido
- `active=false`: os veículos **ativos**, os mesmos de `active=true`.
- `active=abc`: HTTP **200**, também com os veículos ativos.

## Evidências (30/10/2026)
| Consulta | total | Itens |
|---|---|---|
| sem filtro | 15 | ativos e inativos |
| `active=true` | 6 | só ativos ✅ |
| `active=false` | **6** | **os mesmos 6 ativos** ❌ |
| `active=abc` | **6** | os mesmos 6 ativos (deveria ser 400) ❌ |

Para comparar: o mesmo filtro em `GET /clients?active=false` funciona corretamente.

## Impacto
- A tela de frota não consegue mostrar os veículos inativos (para reativar, conferir histórico etc.).
- Quem usa o filtro recebe a informação **oposta** à pedida, sem nenhum aviso de erro.

## Abrangência
- Confirmado em: `GET /vehicles?active=`.
- Não verificado em: outros filtros booleanos da API (o padrão costuma se repetir).

## Sugestão de correção
Causa provável: a query string chega como texto (`"false"`) e é convertida com `Boolean("false")`, que dá
`true`. A correção costuma ser um `@Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)`
junto de `@IsBoolean()` no DTO de filtro, igual ao do módulo de clientes, que funciona.

## Teste automatizado
`tests/vehicles/vehicles.read.spec.ts` → "active=false deve trazer só veículos inativos" e
"active com valor que não é booleano deve ser recusado"
Hoje marcados como falha esperada (`test.fail()`). Quando a correção subir, os testes passam a ser verdes
e a marcação é removida.
