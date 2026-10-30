---
id: BUG-011
titulo: Campos documentados como "nullable" derrubam a API com HTTP 500 quando enviados como null
modulo: service-types, vehicles
rotas: POST /service-types, PATCH /service-types/{id}, POST /vehicles, PATCH /vehicles/{id}
severidade: Média
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30 (vehicles incluído em 2026-10-30)
corrigido_em:
clickup:
teste: tests/service-types/service-types.update.spec.ts › "name": null não deve causar erro 500
---

# BUG-011 — `null` em campos "nullable" causa erro 500

## Descrição
O Swagger marca vários campos dos DTOs de tipo de serviço como `nullable: true`. Ao enviar `null` em alguns
deles, a validação deixa passar e a gravação falha (a coluna no banco não aceita nulo): a API responde
**500 Internal server error**.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Ter um tipo de serviço cadastrado (`<id>`).
3. Enviar:

```bash
curl -X PATCH "https://api-dedetiza.gladiai.com/api/v1/service-types/<id>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":null}'
```

## Resultado esperado
- Campo obrigatório no cadastro (`name`, `status`, `active`, `requiresCertificate`): HTTP **400** dizendo que
  o campo não pode ser nulo — ou tratar `null` como "não alterar" / valor padrão.
- `suggestedMaterials: null` no `PATCH`: tratar como lista vazia (como já acontece no `POST`) ou responder 400.

## Resultado obtido
```json
{ "statusCode": 500, "message": "Internal server error", "path": "/api/v1/service-types/<id>" }
```

## Evidências (30/10/2026)
| Campo enviado como `null` | `POST` | `PATCH` |
|---|---|---|
| `name` | 400 (correto) | **500** |
| `status` | **500** | **500** |
| `active` | **500** | **500** |
| `requiresCertificate` | **500** | **500** |
| `suggestedMaterials` | 201 (vira lista vazia) | **500** |
| `description`, `serviceGuaranteeMonths`, `documentationGuaranteeMonths` | 201 | 200 (limpa o campo, correto) |
| `internalCode` | 409 — ver BUG-007 | 409 — ver BUG-007 |

## Impacto
- Integrações que seguem o Swagger ao pé da letra (geradores de client, formulários que mandam `null` para
  campo não preenchido) recebem erro 500 sem saber o que corrigir.
- O Swagger promete um comportamento que a API não tem.

### Também em vehicles (30/10/2026)
O `UpdateVehicleDto` marca **todos** os campos como `nullable`, e o `CreateVehicleDto` marca o `active`:

| Campo enviado como `null` | `POST /vehicles` | `PATCH /vehicles/{id}` |
|---|---|---|
| `plate`, `model`, `year` | 400 (correto) | **500** |
| `active` | **500** | **500** |
| `defaultLunchStart` + `defaultLunchEnd` | 201 (correto) | 200 (limpa o almoço, correto) |

## Abrangência
- Confirmado em: `POST /service-types`, `PATCH /service-types/{id}`, `POST /vehicles` e `PATCH /vehicles/{id}`.
- O defeito se repete em módulos diferentes. A causa provável é a mesma em todos: `nullable` no DTO de
  campos que são `NOT NULL` no banco. Vale revisar todos os DTOs de uma vez.
- Não verificado em: os demais módulos ainda não testados.

## Sugestão de correção
Tirar `nullable` do Swagger nos campos que não aceitam nulo e validar com `@IsNotEmpty()`/`@IsDefined()`
quando o valor vier `null`; ou converter `null` em "campo ausente" antes de gravar.

## Teste automatizado
`tests/service-types/service-types.update.spec.ts` → "\"<campo>\": null não deve causar erro 500" (5 testes)
`tests/service-types/service-types.contract.spec.ts` → "POST com status/active/requiresCertificate null não deve causar 500"
`tests/vehicles/vehicles.update.spec.ts` → "\"<campo>\": null não deve causar erro 500" (4 testes)
`tests/vehicles/vehicles.contract.spec.ts` → "POST com active null não deve causar 500"
Hoje marcados como falha esperada (`test.fail()`).
