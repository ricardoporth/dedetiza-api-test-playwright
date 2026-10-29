---
id: BUG-002
titulo: Validação de CEP aceita letras e símbolos, gerando endereços com coordenadas erradas
modulo: clients
rotas: POST /clients, POST /clients/{id}/addresses, PATCH /clients/{id}/addresses/{addressId}
severidade: Média
status: Corrigido
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-23
verificado_em: 2026-10-29
corrigido_em: 2026-10-29
clickup:
teste: tests/clients/clients.addresses.spec.ts › deve recusar CEP com letras ou símbolos
---

# BUG-002 — Validação de CEP aceita letras e símbolos

> ✅ **Corrigido em 29/10/2026.** Detectado automaticamente: o teste marcado com `test.fail()` passou a
> passar. Reteste manual confirmou que `"ABCDEFGH"`, `"0100-100"` e `"01001 00"` agora são recusados com
> HTTP 400 nas três rotas afetadas, e que o CEP válido `"01001000"` continua aceito. O teste virou teste de
> regressão (regra RN-CLI-012): se o bug voltar, a suíte acusa.

## Descrição
A validação do campo `zipcode` só confere se o valor tem 8 caracteres. Não confere se são dígitos.
A mensagem de erro da própria API diz "CEP deve ter exatamente 8 digitos", mas valores com letras,
hífen ou espaço são aceitos e salvos.

## Passos para reproduzir
1. Autenticar e obter um token.
2. Ter um cliente cadastrado (`<clientId>`).
3. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/clients/<clientId>/addresses" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"label":"Teste","zipcode":"ABCDEFGH","street":"Praca da Se","number":"1","city":"Sao Paulo","state":"SP"}'
```

## Resultado esperado
HTTP **400** com a mensagem `"CEP deve ter exatamente 8 digitos"`.

## Resultado obtido
HTTP **201**. O endereço é salvo com `"zipcode": "ABCDEFGH"`.

## Evidências
Testes feitos em 23/10/2026 e confirmados em 26/10/2026:

| `zipcode` enviado | Status | Observação |
|---|---|---|
| `"ABCDEFGH"` | 201 | salvo como está |
| `"0100-100"` | 201 | salvo com o hífen |
| `"01001 00"` | 201 | salvo com espaço; **geocodificado em Salvador (latitude -12.97)** para uma rua de São Paulo |
| `"123"` | 400 | recusado corretamente |
| `"010010000"` | 400 | recusado corretamente |
| `"01001000"` | 201 | correto |

## Impacto
- Endereços com CEP inválido entram na base de dados.
- O geocoding pode gerar coordenadas erradas. Como o sistema calcula rotas e agenda visitas a partir
  do endereço, um técnico pode ser enviado para o local errado.

## Abrangência
- Confirmado em:
  - `POST /clients` (endereços enviados no cadastro do cliente)
  - `POST /clients/{id}/addresses`
  - `PATCH /clients/{id}/addresses/{addressId}`
- Não verificado em: outros módulos que recebam CEP (ainda não testados).

## Sugestão de correção
Validar com uma expressão regular de 8 dígitos numéricos (`^\d{8}$`), ou normalizar o valor
(remover hífen e espaço) antes de validar. Vale o time decidir qual dos dois comportamentos é o desejado.

## Teste automatizado
`tests/clients/clients.addresses.spec.ts` → "deve recusar CEP com letras ou símbolos"
Hoje marcado como falha esperada (`test.fail()`). Quando a correção subir, o teste passa a ser verde
e a marcação é removida.
