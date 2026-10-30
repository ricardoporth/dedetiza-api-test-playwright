---
id: BUG-004
titulo: E-mail que só difere em maiúsculas/minúsculas cria outra conta, e o login diferencia maiúsculas
modulo: users
rotas: POST /users, POST /auth/login
severidade: Média
status: Corrigido
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-29
verificado_em: 2026-10-30
corrigido_em: 2026-10-30
clickup:
teste: tests/users/users.create.spec.ts › não deve permitir o mesmo e-mail escrito com letras maiúsculas
---

# BUG-004 — E-mail duplicado com maiúsculas e login sensível a maiúsculas

> ✅ **Corrigido em 30/10/2026.** Detectado automaticamente: o teste marcado com `test.fail()` passou a
> passar. O reteste manual confirmou: o e-mail é salvo em minúsculas, criar outra conta com o mesmo e-mail
> em qualquer combinação de maiúsculas responde 409, e o login funciona com qualquer grafia. Os testes viraram
> regressão (regra RN-USR-014). A parte do login foi verificada manualmente e não tem teste automatizado,
> para não gastar o limite de 5 logins por minuto.

## Descrição
A verificação de e-mail duplicado diferencia maiúsculas de minúsculas. Por isso
`joao@empresa.com` e `JOAO@EMPRESA.COM` viram duas contas diferentes. O login também diferencia
maiúsculas: quem digitar o e-mail com uma letra maiúscula a mais recebe "Credenciais inválidas".

## Passos para reproduzir
1. Autenticar como admin e obter um token.
2. Criar um usuário com `"email": "qa.exemplo@example.com"`:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/users" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"roleId":"<roleId>","name":"Usuario A","cpf":"<cpf válido>","email":"qa.exemplo@example.com","password":"SenhaUm#2026","confirmPassword":"SenhaUm#2026"}'
```

3. Criar outro usuário com o mesmo e-mail em maiúsculas, `"email": "QA.EXEMPLO@EXAMPLE.COM"` (e outro CPF).
4. Tentar fazer login com o e-mail do passo 2 escrito em maiúsculas.

## Resultado esperado
- Passo 3: HTTP **409** `"E-mail já cadastrado. Informe um e-mail diferente."`
- Passo 4: o login identifica a conta independentemente de maiúsculas/minúsculas.

## Resultado obtido
- Passo 3: HTTP **201**. A segunda conta é criada, salva como `"QA.EXEMPLO@EXAMPLE.COM"`.
- Passo 4: cada grafia autentica uma conta diferente.

## Evidências (29/10/2026)
| Ação | Resultado |
|---|---|
| Criar usuário A com `qa.auto.case…@example.com` | 201 |
| Criar usuário B com `QA.AUTO.CASE…@EXAMPLE.COM` | **201** (deveria ser 409) |
| Login com e-mail minúsculo + senha A | 200, entra como **A** |
| Login com e-mail MAIÚSCULO + senha B | 200, entra como **B** |
| Login com e-mail minúsculo + senha B | 400 "Credenciais inválidas" |

## Impacto
- **Contas duplicadas** para a mesma pessoa, com senhas e permissões diferentes.
- **Falha de login** para quem digita o e-mail com maiúscula, por exemplo pelo corretor automático do celular.
- Na prática, e-mails não diferenciam maiúsculas (os provedores entregam para a mesma caixa), então o
  sistema permite duas contas para o mesmo endereço.

## Abrangência
- Confirmado em: `POST /users` (duplicidade) e `POST /auth/login` (autenticação).
- Não verificado em: `PATCH /users/{id}` (alterar o e-mail para uma variação de um existente) e
  `POST /portal/login`.

## Sugestão de correção
Normalizar o e-mail (`trim` + minúsculas) ao salvar e ao autenticar, e verificar a unicidade sobre o
valor normalizado. Os dados atuais podem precisar de uma migração para detectar duplicidades existentes.

## Teste automatizado
`tests/users/users.create.spec.ts` → "não deve permitir o mesmo e-mail escrito com letras maiúsculas"
Hoje marcado como falha esperada (`test.fail()`).
