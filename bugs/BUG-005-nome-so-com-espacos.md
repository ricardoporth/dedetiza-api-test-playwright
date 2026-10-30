---
id: BUG-005
titulo: Nome de usuário só com espaços é aceito
modulo: users
rotas: POST /users
severidade: Baixa
status: Corrigido
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-29
verificado_em: 2026-10-30
corrigido_em: 2026-10-30
clickup:
teste: tests/users/users.create.spec.ts › deve recusar nome só com espaços
---

# BUG-005 — Nome de usuário só com espaços é aceito

> ✅ **Corrigido em 30/10/2026.** Detectado automaticamente: o teste marcado com `test.fail()` passou a
> passar. O reteste manual confirmou que nomes só com espaços ou só com tabs são recusados com 400
> `"name should not be empty"`. Os testes viraram regressão (regra RN-USR-015). Os mesmos defeitos em
> outros módulos (BUG-009 em service-types, BUG-014 em vehicles) continuam abertos.

## Descrição
O campo `name` recusa texto vazio (`""`), mas aceita texto formado só por espaços (`"   "`). O usuário
é criado sem nome visível.

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/users" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"roleId":"<roleId>","name":"   ","cpf":"<cpf válido>","password":"Senha#2026","confirmPassword":"Senha#2026"}'
```

## Resultado esperado
HTTP **400** com `"name should not be empty"`, o mesmo comportamento de `"name": ""`.

## Resultado obtido
HTTP **201**. O usuário é criado com `"name": "   "`.

## Evidências (29/10/2026)
| `name` enviado | Status |
|---|---|
| `""` | 400 `"name should not be empty"` |
| `"   "` | **201** |
| `null` | 400 |

## Impacto
Usuário sem nome visível em listas, escalas, ordens de serviço e relatórios. Fica difícil identificar
quem executou um serviço ou é responsável por um cliente.

## Abrangência
- Confirmado em: `POST /users`.
- Não verificado em: `PATCH /users/{id}` e nos campos `name` de outros módulos.

## Sugestão de correção
Aplicar `trim` antes de validar (ou validar com `@IsNotEmpty()` depois do `trim`). Vale aplicar o mesmo
tratamento aos outros campos de texto obrigatórios.

## Teste automatizado
`tests/users/users.create.spec.ts` → "deve recusar nome só com espaços"
Hoje marcado como falha esperada (`test.fail()`).
