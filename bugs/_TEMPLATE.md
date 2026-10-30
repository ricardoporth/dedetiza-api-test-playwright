---
id: BUG-XXX

titulo: BUG-API - <rota> - <Título>
modulo: <tag do módulo no Swagger, ex.: clients>
rotas: <rotas afetadas, ex.: POST /clients>
severidade: <Crítica | Alta | Média | Baixa>
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: AAAA-MM-DD
verificado_em: AAAA-MM-DD
teste: <arquivo.spec.ts> › <nome do teste>
---

# BUG-API — <Título>

## Descrição
<O que está errado, em 2 ou 3 frases. Sem opinião: só o comportamento observado.>

## Passos para reproduzir
1. Autenticar e obter um token.
2. <pré-condição, se houver — ex.: ter um cliente cadastrado>
3. Enviar:

```bash
curl -X <MÉTODO> "https://api-dedetiza.gladiai.com/api/v1/<rota>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '<corpo>'
```

> Nunca coloque um token real no relatório.

## Resultado esperado
<Status HTTP e resposta que deveriam acontecer.>

## Resultado obtido
<Status HTTP e resposta que acontecem hoje.>

## Evidências
<Respostas reais da API, tabelas com variações testadas, datas.>

## Impacto
<Por que isso importa para o negócio e para o usuário, não só para o código.>

## Abrangência
- Confirmado em: <rotas onde foi reproduzido>
- Não verificado em: <rotas suspeitas que ainda não foram testadas, se houver>

## Sugestão de correção
<Opcional. Uma sugestão, não uma ordem: quem decide a solução é o time.>

## Teste automatizado
`<caminho do arquivo>` → "<nome do teste>"
Hoje marcado como falha esperada (`test.fail()`). Quando a correção subir, o teste passa a ser verde
e a marcação é removida.
