---
id: BUG-009
titulo: Nome de tipo de serviço só com espaços é aceito
modulo: service-types
rotas: POST /service-types, PATCH /service-types/{id}
severidade: Baixa
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
corrigido_em:
clickup:
teste: tests/service-types/service-types.create.spec.ts › deve recusar nome só com espaços
---

# BUG-009 — Nome só com espaços é aceito

## Descrição
O nome vazio (`""`) é recusado com 400, mas um nome formado só por espaços ou tabs (`"   "`) passa na
validação e cria um tipo de serviço sem nome visível.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/service-types" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"   "}'
```

## Resultado esperado
HTTP **400** com `"name should not be empty"`, igual ao nome vazio.

## Resultado obtido
HTTP **201**, com `"name": "   "`.

## Evidências (30/10/2026)
| Nome | Status |
|---|---|
| `""` | 400 `name should not be empty` |
| `"   "` | **201** (e, por ser soft delete, o nome `"   "` fica reservado para sempre: um segundo envio dá 409) |
| 40 caracteres misturando espaços e tabs | **201** |

## Impacto
Aparece uma opção em branco nas listas de tipo de serviço, que não dá para identificar nem remover do
cadastro (o DELETE só desativa).

## Abrangência
- Confirmado em: `POST /service-types`.
- Não verificado em: `PATCH /service-types/{id}` (provável, pois usa a mesma validação).
- Relacionado: BUG-005 (mesmo comportamento no nome de usuários).

## Sugestão de correção
Aplicar `trim()` antes do `@IsNotEmpty()` no nome (ex.: `@Transform(({ value }) => value?.trim())`).

## Teste automatizado
`tests/service-types/service-types.create.spec.ts` → "deve recusar nome só com espaços"
Hoje marcado como falha esperada (`test.fail()`).
