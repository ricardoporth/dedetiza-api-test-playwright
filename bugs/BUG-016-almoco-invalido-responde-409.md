---
id: BUG-016

titulo: BUG-API - POST /vehicles - Intervalo de almoço inválido responde 409 Conflict em vez de 400
modulo: vehicles
rotas: POST /vehicles, PATCH /vehicles/{id}
severidade: Baixa
status: Aberto
ambiente: dev — https://api-dedetiza.gladiai.com/api/v1
encontrado_em: 2026-10-30
verificado_em: 2026-10-30
teste: tests/vehicles/vehicles.create.spec.ts › intervalo de almoço inválido deve responder 400 (erro de validação), não 409
---

# BUG-API — Intervalo de almoço inválido responde 409 em vez de 400

## Descrição
Quando o intervalo de almoço é inválido (início depois do fim, início igual ao fim ou só um dos dois
horários), a API recusa corretamente, mas com **409 Conflict**. O 409 indica conflito com o estado atual
de um recurso (como a placa duplicada). Um dado inválido no próprio corpo da requisição é um erro de
validação, **400 Bad Request**.

## Passos para reproduzir
1. Autenticar e obter um token.
2. Enviar:

```bash
curl -X POST "https://api-dedetiza.gladiai.com/api/v1/vehicles" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"plate":"ABC1D23","model":"Fiat Strada","year":2023,"defaultLunchStart":"14:00","defaultLunchEnd":"13:00"}'
```

> Nunca coloque um token real no relatório.

## Resultado esperado
HTTP **400** com a mensagem `"O intervalo padrão de almoço deve ter início e fim válidos"`.

## Resultado obtido
HTTP **409** com a mesma mensagem.

## Evidências (30/10/2026)
| Cenário | Status |
|---|---|
| início depois do fim (`14:00` → `13:00`) | 409 |
| início igual ao fim (`12:00` → `12:00`) | 409 |
| só `defaultLunchStart` | 409 |
| só `defaultLunchEnd` | 409 |
| `PATCH` removendo só o fim | 409 |
| horário em formato errado (`25:00`) | 400 ✅ (para comparar) |

No Swagger, o 409 de `POST /vehicles` está documentado só como "Placa já cadastrada neste tenant".

## Impacto
- Uma tela ou integração que trata 409 como "placa duplicada" vai mostrar a mensagem errada.
- Monitoramento que separa erros do usuário (400) de conflitos (409) fica com números distorcidos.

## Abrangência
- Confirmado em: `POST /vehicles` e `PATCH /vehicles/{id}`.

## Sugestão de correção
Lançar `BadRequestException` (400) nessa validação, em vez de `ConflictException` (409). Se o 409 for
intencional, documentar no Swagger esse segundo significado do 409.

## Teste automatizado
`tests/vehicles/vehicles.create.spec.ts` → "intervalo de almoço inválido deve responder 400 (erro de validação), não 409"
Hoje marcado como falha esperada (`test.fail()`). A regra de recusar o intervalo (RN-VEI-005) é verificada
em testes separados, que passam.
