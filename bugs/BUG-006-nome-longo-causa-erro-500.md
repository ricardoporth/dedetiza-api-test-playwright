---
id: BUG-006
titulo: Nome de usuário com mais de 255 caracteres derruba a API com HTTP 500
modulo: users
rotas: POST /users
severidade: Média
status: Corrigido
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-29
verificado_em: 2026-10-30
corrigido_em: 2026-10-30
clickup:
teste: tests/users/users.create.spec.ts › deve recusar nome com 256 caracteres com 400, e não quebrar com 500
---

# BUG-006 — Nome com mais de 255 caracteres causa erro 500

> ✅ **Corrigido em 30/10/2026.** Detectado automaticamente: o teste marcado com `test.fail()` passou a
> passar. O reteste manual confirmou: 255 caracteres é aceito, e 256 ou 1.000 respondem 400
> `"name must be shorter than or equal to 255 characters"`, sem erro 500. O teste virou regressão (regra RN-USR-016).

## Descrição
O campo `name` do usuário não tem validação de tamanho máximo. Um nome com 256 caracteres ou mais
passa pela validação e falha ao ser salvo, e a API responde **500 Internal server error** em vez de um
erro de validação (400).

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Enviar um `name` com 256 caracteres:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/users" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"roleId":"<roleId>","name":"<256 letras a>","cpf":"<cpf válido>","password":"Senha#2026","confirmPassword":"Senha#2026"}'
```

## Resultado esperado
HTTP **400** com uma mensagem como `"name must be shorter than or equal to 255 characters"`, o mesmo
comportamento do cadastro de clientes.

## Resultado obtido
```json
{ "statusCode": 500, "message": "Internal server error", "path": "/api/v1/users", "timestamp": "2026-10-29T19:18:58.341Z" }
```

## Evidências (29/10/2026)
| Tamanho do `name` | Status |
|---|---|
| 100, 150, 200 | 201 |
| **255** | 201 (limite aceito) |
| **256** | **500** |
| 300, 1.000, 10.000 | **500** |

Comparação com outros campos e módulos, que validam corretamente:

| Campo | Entrada | Status |
|---|---|---|
| `users.rg` | 21 caracteres | 400 `"rg must be shorter than or equal to 20 characters"` |
| `users.phone` | 21 caracteres | 400 |
| `clients.name` | 256 caracteres | 400 `"name must be shorter than or equal to 255 characters"` |

## Impacto
- Erro 500 é uma falha não tratada: aparece como "erro inesperado" para quem usa o sistema, sem dizer
  o que corrigir.
- Erros 500 podem disparar alertas de monitoramento e esconder falhas reais.
- O padrão sugere que a coluna no banco tem limite de 255 e a validação da API (DTO) não acompanha.
  Vale revisar outros campos de texto sem `maxLength`.

## Abrangência
- Confirmado em: `POST /users`.
- Não verificado em: `PATCH /users/{id}` e nos campos `cnh`, `cnhValidity` (que também não
  documentam limite no Swagger).

## Sugestão de correção
Adicionar `@MaxLength(255)` ao `name` no DTO de criação e de edição de usuário, e documentar o
`maxLength` no Swagger.

## Teste automatizado
`tests/users/users.create.spec.ts` → "deve recusar nome com 256 caracteres com 400, e não quebrar com 500"
Hoje marcado como falha esperada (`test.fail()`). O teste "deve aceitar nome com 255 caracteres (limite máximo)"
garante que a correção não vai recusar nomes válidos.
