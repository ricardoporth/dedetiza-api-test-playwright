---
id: BUG-014

titulo: BUG-API - POST /vehicles - Modelo do veículo só com espaços é aceito
modulo: vehicles
rotas: POST /vehicles, PATCH /vehicles/{id}
severidade: Baixa
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
teste: tests/vehicles/vehicles.create.spec.ts › deve recusar modelo só com espaços
---

# BUG-API — Modelo do veículo só com espaços é aceito

## Descrição
O campo `model` recusa texto vazio (`""`), mas aceita texto formado só por espaços (`"   "`), tanto no
cadastro quanto na edição. O veículo fica sem modelo visível.

## Passos para reproduzir
1. Autenticar e obter um token.
2. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/vehicles" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"plate":"ABC1D23","model":"   ","year":2023}'
```

> Nunca coloque um token real no relatório.

## Resultado esperado
HTTP **400** com `"model should not be empty"`, o mesmo comportamento de `"model": ""`.

## Resultado obtido
HTTP **201** (no `POST`) e **200** (no `PATCH`). O veículo é salvo com `"model": "   "`.

## Evidências (30/10/2026)
| Rota | `model` enviado | Status |
|---|---|---|
| `POST /vehicles` | `""` | 400 `"model should not be empty"` |
| `POST /vehicles` | `"   "` | **201** |
| `PATCH /vehicles/{id}` | `"   "` | **200** |

## Impacto
Veículo sem identificação visível nas telas de frota, escalas e rotas. Fica difícil saber qual veículo foi
alocado a um turno.

## Abrangência
- Confirmado em: `POST /vehicles` e `PATCH /vehicles/{id}`.
- Relacionado: BUG-005 (nome de usuário) e BUG-009 (nome de tipo de serviço). É o mesmo comportamento,
  em módulos diferentes, e provavelmente tem a mesma causa: a validação não aplica `trim` antes de checar
  se o texto está vazio. Vale corrigir de forma centralizada.

## Sugestão de correção
Aplicar `trim` antes de validar os campos de texto obrigatórios (por exemplo, com um `@Transform` global
no `ValidationPipe`), e não campo a campo.

## Teste automatizado
`tests/vehicles/vehicles.create.spec.ts` e `tests/vehicles/vehicles.update.spec.ts` → "deve recusar modelo só com espaços"
Hoje marcados como falha esperada (`test.fail()`). Quando a correção subir, os testes passam a ser verdes
e a marcação é removida.
