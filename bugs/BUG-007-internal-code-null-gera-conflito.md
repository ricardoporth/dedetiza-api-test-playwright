---
id: BUG-007
titulo: "internalCode": null é tratado como um código e colide com outros tipos de serviço sem código (409)
modulo: service-types
rotas: POST /service-types, PATCH /service-types/{id}
severidade: Média
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
corrigido_em:
clickup:
teste: tests/service-types/service-types.create.spec.ts › "internalCode": null deve ser aceito como "sem código"
---

# BUG-007 — `internalCode: null` gera conflito de código interno

## Descrição
O Swagger documenta `internalCode` como opcional e `nullable`. Enviar `"internalCode": null` faz a API
responder **409 "Já existe um tipo de serviço com esse código interno neste tenant"** sempre que já existe
algum tipo de serviço sem código. Pelo mesmo motivo, não há como **remover** o código de um tipo que já tem
um (`PATCH` com `internalCode: null` também responde 409).

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Ter pelo menos um tipo de serviço cadastrado sem código interno (o ambiente de dev já tem vários).
3. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/service-types" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Tipo sem código","internalCode":null}'
```

## Resultado esperado
HTTP **201**, com `"internalCode": null` — "sem código" não é um valor e não pode colidir com outro "sem código".
No `PATCH`, HTTP **200** com o código removido.

## Resultado obtido
```json
{ "statusCode": 409, "message": "Já existe um tipo de serviço com esse código interno neste tenant", "path": "/api/v1/service-types" }
```

## Evidências (30/10/2026)
| Chamada | Status |
|---|---|
| `POST` sem o campo `internalCode` | 201 (`internalCode: null`) |
| `POST` com `"internalCode": null` | **409** |
| `PATCH` de um tipo com código, enviando só `{"internalCode": null}` | **409** |
| `PATCH` com `{"description": null}` ou `{"serviceGuaranteeMonths": null}` | 200 (os outros campos nullable funcionam) |

## Impacto
- Telas e integrações costumam mandar `null` para campo opcional vazio: o cadastro falha com uma mensagem
  enganosa ("código já cadastrado") para um código que nem foi informado.
- Depois que um tipo recebe código, ele nunca mais pode ficar sem código.

## Abrangência
- Confirmado em: `POST /service-types`, `PATCH /service-types/{id}`.
- Não verificado em: outros módulos com campos únicos opcionais.

## Sugestão de correção
Na checagem de unicidade, ignorar `internalCode` nulo (ou normalizar `null` para "campo ausente" antes da checagem).
No banco, um índice único comum já permite vários `NULL`; o problema parece estar na consulta de duplicidade.

## Teste automatizado
`tests/service-types/service-types.create.spec.ts` → "\"internalCode\": null deve ser aceito como \"sem código\""
`tests/service-types/service-types.update.spec.ts` → "deve limpar o código interno enviando null"
Hoje marcados como falha esperada (`test.fail()`). Quando a correção subir, os testes passam a ser verdes
e a marcação é removida.
