---
id: BUG-008
titulo: Nome de tipo de serviço duplicado é aceito quando muda só maiúsculas/minúsculas ou espaços nas pontas
modulo: service-types
rotas: POST /service-types, PATCH /service-types/{id}
severidade: Média
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
corrigido_em:
clickup:
teste: tests/service-types/service-types.create.spec.ts › não deve permitir o mesmo nome escrito com letras maiúsculas
---

# BUG-008 — Nome duplicado com maiúsculas ou espaços é aceito

## Descrição
O nome do tipo de serviço é único por tenant (o mesmo nome exato dá 409), mas a comparação diferencia
maiúsculas/minúsculas e não remove espaços das pontas. "Dedetização residencial", "DEDETIZAÇÃO RESIDENCIAL"
e "  Dedetização residencial  " viram três cadastros diferentes. Os espaços também são gravados no nome.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Cadastrar `{"name": "Dedetização residencial QA"}` → 201.
3. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/service-types" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"DEDETIZAÇÃO RESIDENCIAL QA"}'
```

## Resultado esperado
HTTP **409** "Já existe um tipo de serviço com esse nome neste tenant", como acontece com o nome idêntico.
O nome deveria ser gravado sem os espaços das pontas.

## Resultado obtido
HTTP **201**: um segundo tipo de serviço com o "mesmo" nome.

## Evidências (30/10/2026)
| Nome enviado (existente: `[QA-AUTO] Tipo x`) | Status | Nome gravado |
|---|---|---|
| `[QA-AUTO] Tipo x` | 409 | — |
| `[QA-AUTO] TIPO X` | **201** | `[QA-AUTO] TIPO X` |
| `  [QA-AUTO] Tipo x  ` | **201** | `  [QA-AUTO] Tipo x  ` (com os espaços) |

O mesmo vale para o código interno: `qa-abc` é aceito quando `QA-ABC` já existe.

## Impacto
- Listas e selects da tela mostram tipos de serviço repetidos; o técnico pode escolher o "errado" e
  relatórios por tipo de serviço ficam divididos.
- Os espaços gravados quebram a ordenação (a listagem ordena por nome: os nomes com espaço vão para o topo).

## Abrangência
- Confirmado em: `POST /service-types` (nome e código interno), `PATCH /service-types/{id}` (nome com espaços).
- Relacionado: BUG-004 (mesmo comportamento no e-mail de usuários).

## Sugestão de correção
Aplicar `trim()` no nome e no código antes de validar e gravar, e comparar a unicidade sem diferenciar
maiúsculas (ex.: índice único em `lower(name)` por tenant).

## Teste automatizado
`tests/service-types/service-types.create.spec.ts` → "não deve permitir o mesmo nome escrito com letras maiúsculas"
e "não deve permitir o mesmo nome com espaços nas pontas".
Hoje marcados como falha esperada (`test.fail()`).
