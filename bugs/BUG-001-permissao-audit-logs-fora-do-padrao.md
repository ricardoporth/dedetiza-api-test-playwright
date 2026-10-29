---
id: BUG-001
titulo: Permissão "audit_logs:read" usa underscore, mas o módulo dela é "audit-logs"
modulo: permissions
rotas: GET /permissions, GET /permissions/me
severidade: Baixa
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-23
verificado_em: 2026-10-26
corrigido_em:
clickup:
teste: tests/permissions/permissions.spec.ts › o prefixo do slug deve ser igual ao módulo da permissão
---

# BUG-001 — Permissão `audit_logs:read` fora do padrão de nomenclatura

## Descrição
Todas as permissões seguem o padrão `<módulo>:<ação>`, em que o prefixo do `slug` é igual ao campo
`module`. A única exceção é a permissão de leitura de logs de auditoria: o slug usa underscore
(`audit_logs`), enquanto o módulo usa hífen (`audit-logs`).

## Passos para reproduzir
1. Autenticar e obter um token.
2. Enviar:

```bash
curl "https://api-dedetiza.gladiai.com/api/v1/permissions" \
  -H "Authorization: Bearer <token>"
```

3. Procurar a permissão com `"module": "audit-logs"`.

## Resultado esperado
```json
{ "slug": "audit-logs:read", "module": "audit-logs" }
```

## Resultado obtido
```json
{ "slug": "audit_logs:read", "module": "audit-logs", "description": "Visualizar logs de auditoria" }
```

## Evidências
- 1 das 104 permissões do catálogo diverge do padrão. As outras 103 seguem `módulo:ação` com hífen.
- A mesma permissão aparece como `audit_logs:read` em `GET /permissions/me` para o perfil Administrador.
- Testado em 23/10/2026 e confirmado em 26/10/2026.

## Impacto
- Qualquer código que monte o nome da permissão a partir do módulo (por exemplo,
  `${module}:read` → `audit-logs:read`) não vai encontrar a permissão real (`audit_logs:read`).
  Isso pode esconder a tela de auditoria de quem tem permissão, ou exigir um tratamento especial
  só para esse caso.
- Inconsistência de nomenclatura que tende a gerar erros em novas funcionalidades.

## Abrangência
- Confirmado em: `GET /permissions` e `GET /permissions/me`.
- Não verificado em: `PUT /roles/{id}/permissions` (atribuição de permissões a perfis) e no
  controle de acesso das rotas de `audit-logs`.

## Sugestão de correção
Padronizar o slug para `audit-logs:read`. Como a permissão pode já estar atribuída a perfis, a mudança
provavelmente precisa de uma migração de dados. Alternativa: confirmar que o underscore é intencional,
e nesse caso este item vira "Não é bug".

## Teste automatizado
`tests/permissions/permissions.spec.ts` → "o prefixo do slug deve ser igual ao módulo da permissão"
Hoje marcado como falha esperada (`test.fail()`). Quando a correção subir, o teste passa a ser verde
e a marcação é removida.
