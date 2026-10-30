# Bugs encontrados pelos testes automatizados

Cada bug tem um arquivo próprio nesta pasta, seguindo o modelo [`_TEMPLATE.md`](_TEMPLATE.md).
O arquivo é a fonte do relatório: o conteúdo pode ser copiado direto para o ticket no ClickUp
(o ClickUp aceita Markdown).

## Bugs registrados

| ID | Título | Módulo | Severidade | Status | ClickUp |
|---|---|---|---|---|---|
| [BUG-001](BUG-001-permissao-audit-logs-fora-do-padrao.md) | Permissão `audit_logs:read` fora do padrão de nomenclatura | permissions | Baixa | Aberto | — |
| [BUG-002](BUG-002-cep-aceita-letras-e-simbolos.md) | Validação de CEP aceita letras e símbolos | clients | Média | ✅ Corrigido (29/10) | — |
| BUG-003 | *(reservado: perfil com usuários inativos não pode ser removido — será registrado com o teste de `DELETE /roles/{id}`)* | roles | — | — | — |
| [BUG-004](BUG-004-email-duplicado-com-maiusculas.md) | E-mail duplicado com maiúsculas cria outra conta; login diferencia maiúsculas | users | Média | ✅ Corrigido (30/10) | — |
| [BUG-005](BUG-005-nome-so-com-espacos.md) | Nome de usuário só com espaços é aceito | users | Baixa | ✅ Corrigido (30/10) | — |
| [BUG-006](BUG-006-nome-longo-causa-erro-500.md) | Nome com mais de 255 caracteres causa erro 500 | users | Média | ✅ Corrigido (30/10) | — |

## Como registrar um bug novo

1. Copie `_TEMPLATE.md` para `BUG-XXX-descricao-curta.md` (próximo número livre, descrição em minúsculas com hífens).
2. Preencha **todas** as seções. Regra de ouro: o dev precisa conseguir reproduzir sem fazer nenhuma pergunta.
3. Confirme que o bug ainda acontece antes de enviar (preencha `verificado_em`).
4. No teste automatizado, marque o bug conhecido:
   ```ts
   test('...', { annotation: { type: 'bug', description: 'BUG-XXX: resumo do bug' } }, async () => {
     test.fail(); // Relatório: bugs/BUG-XXX-descricao-curta.md
     ...
   });
   ```
5. Crie o ticket no ClickUp colando o conteúdo do arquivo. Depois, preencha o campo `clickup` com o link
   e atualize a tabela acima.

## Ciclo de vida

| Status | Significado |
|---|---|
| **Aberto** | Encontrado e documentado, ainda não enviado ao time |
| **Reportado** | Ticket criado no ClickUp |
| **Em correção** | O time está trabalhando na correção |
| **Corrigido** | Correção confirmada pelo teste automatizado (o `test.fail()` foi removido) |
| **Não é bug** | O time confirmou que o comportamento é intencional. O teste vira regra de negócio. |

Quando a correção subir, o Playwright avisa que o teste "passou inesperadamente". Aí é só remover o
`test.fail()`, mudar o status para **Corrigido** e preencher `corrigido_em`.

## Severidade

| Nível | Quando usar |
|---|---|
| **Crítica** | Perda ou vazamento de dados, falha de segurança, sistema ou fluxo principal fora do ar |
| **Alta** | Funcionalidade importante quebrada, sem alternativa |
| **Média** | Dado inconsistente ou funcionalidade com problema, mas com alternativa |
| **Baixa** | Inconsistência pequena, sem impacto direto para o usuário |

A severidade mede o tamanho do problema. A **prioridade** (urgência) é decidida pelo time.
