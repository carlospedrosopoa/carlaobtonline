# Pagamentos Online (Hub Pagamentos BT) - Front do Atleta

Este documento descreve como consumir o fluxo de **pagamento online** no frontend do atleta para quitar um **CardCliente** (consumo), usando o **Hub Pagamentos BT**.

## Pré-requisitos (Admin/Arena)
- No cadastro da arena (Point), habilitar: `pagamentoOnlineAtivo = true`.

## Visão geral do fluxo
1. Front lista os cards do usuário logado.
2. Usuário escolhe um card em aberto e informa:
   - Método (`PIX` ou `CREDIT_CARD`)
   - CPF (obrigatório)
   - Valor a pagar (opcional: se não enviar, paga o saldo total)
   - `cardEncrypted` (obrigatório se for cartão)
3. Front chama o endpoint unificado de checkout do backend.
4. Backend cria uma transação no Hub e retorna os dados para pagamento:
   - PIX: `qrCode.text` + links (`QRCODE.PNG` quando houver)
   - Cartão: links para pagamento quando aplicável
5. Front mostra o QR Code (ou abre o link) e faz polling do status.
6. Quando o Hub confirmar `PAID`, o backend cria `PagamentoCard` e fecha o card se quitado.

## Endpoints (Backend)

### 1) Criar pagamento (PIX ou cartão)
**POST** `/api/user/pagamento/online/checkout`  
**Auth:** obrigatório (JWT Bearer ou Basic, via `Authorization`)

**Headers**
- `X-Client_APP: APP_ATLETA | ARENA_FRONT` (obrigatório)

**Body JSON**
```json
{
  "cardId": "string",
  "paymentMethod": "PIX",
  "cpf": "00000000000",
  "orderId": "string (opcional)",
  "descricao": "string (opcional)"
}
```

Para cartão:
```json
{
  "cardId": "string",
  "paymentMethod": "CREDIT_CARD",
  "cardEncrypted": "string",
  "cpf": "00000000000"
}
```

Para pagamento parcial (PIX ou cartão), envie `valor`:
```json
{
  "cardId": "string",
  "valor": 120.5,
  "paymentMethod": "PIX",
  "cpf": "00000000000"
}
```

**Response 200 JSON**
```json
{
  "transactionId": "uuid",
  "orderId": "string",
  "pagbankOrderId": "string | null",
  "status": "PENDING",
  "qrCode": {
    "text": "00020126...",
    "links": [
      { "rel": "QRCODE.PNG", "href": "https://..." }
    ]
  },
  "links": [
    { "rel": "PAY", "href": "https://..." }
  ]
}
```

### 2) Consultar status
**GET** `/api/user/pagamento/online/status/:transactionId`  
**Auth:** obrigatório

**Response 200 JSON**
```json
{
  "status": "PENDING | PAID | CANCELED | REFUNDED"
}
```

## Observações importantes
- O status é atualizado pelo callback do Hub (não pelo frontend).
- Se o Hub ainda não estiver enviando callback para este backend, o status ficará `PENDING`.
- Em produção, configure `HUB_PAYMENTS_BASE_URL` e `HUB_PAYMENTS_API_KEY` no backend.
