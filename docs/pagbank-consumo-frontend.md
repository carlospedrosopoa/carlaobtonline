# PagBank no Front (Meu Consumo)

Este documento descreve como consumir o fluxo de pagamento **PagBank** no frontend do atleta para quitar um **CardCliente** (consumo).

## Visão geral do fluxo

1. Front lista os cards do usuário logado.
2. Usuário escolhe um card em aberto e informa:
   - Valor a pagar (parcial ou total do saldo)
   - CPF (obrigatório)
   - Parcelas (opcional; para cartão)
3. Front chama o endpoint de checkout do backend.
4. Backend cria um checkout “hosted” no PagBank e devolve `checkoutUrl`.
5. Front redireciona o navegador para `checkoutUrl`.
6. PagBank chama o webhook do backend (callback) e, ao receber `PAID`, o backend:
   - cria um `PagamentoCard`
   - e fecha o card se o total pago atingir o total.
7. PagBank redireciona o usuário de volta para a tela do consumo com `pagbank_callback=<orderId>`.
8. Front consulta o status do pagamento e atualiza a lista.

## Pré-requisitos (Admin/Arena)

No cadastro da arena (Point), configurar:
- `pagBankAtivo = true`
- `pagBankEnv = sandbox | production`
- `pagBankToken` (Bearer)
- `pagBankWebhookToken` (opcional, recomendado)

Também é necessário aplicar a migration que adiciona os campos no `Point`.

## Endpoints (Backend)

### 1) Criar checkout

**POST** `/api/user/pagamento/pagbank/checkout`  
**Auth:** obrigatório (JWT Bearer ou Basic, via `Authorization`)

**Body JSON**
```json
{
  "cardId": "string",
  "valor": 120.50,
  "orderId": "string",
  "descricao": "string (opcional)",
  "parcelas": 1,
  "cpf": "00000000000"
}
```

**Regras importantes**
- `cpf` é obrigatório e deve ter 11 dígitos (somente números).
- `valor` deve ser `> 0` e `<= saldo` do card.
- `orderId` deve ser **único** por tentativa de pagamento (use UUID).
- Se `pagBankAtivo` estiver `false` ou o token não estiver configurado para a arena, o endpoint retorna `400`.

**Response 200 JSON**
```json
{
  "success": true,
  "checkoutUrl": "https://...",
  "orderId": "string",
  "checkoutId": "string | null"
}
```

### 2) Consultar status

**GET** `/api/user/pagamento/pagbank/status/:orderId`  
**Auth:** obrigatório

**Response 200 JSON**
```json
{
  "status": "PENDING | PAID | ..."
}
```

Observação: o status vem do registro em `PagamentoPagBank`, atualizado pelo webhook.

## Redirect e query string

Após o pagamento, o PagBank redireciona o usuário para:

`/app/atleta/consumo?pagbank_callback=<orderId>`

O front deve:
- ler o query param `pagbank_callback`
- consultar o status em `/api/user/pagamento/pagbank/status/<orderId>`
- recarregar os cards (ex.: `GET /api/user/meu-consumo?incluirPagamentos=true`)

## Implementação sugerida no frontend (exemplo)

### Gerar `orderId`

Use UUID (ou outra estratégia com unicidade garantida).

```ts
function gerarOrderId() {
  return `PAGBANK-${crypto.randomUUID()}`;
}
```

### Criar checkout e redirecionar

```ts
import { api } from '@/lib/api';

type CheckoutResponse = {
  success: boolean;
  checkoutUrl?: string;
  orderId: string;
  checkoutId?: string | null;
  mensagem?: string;
};

export async function pagarComPagBank(params: {
  cardId: string;
  valor: number;
  cpf: string;
  parcelas?: number;
  descricao?: string;
}) {
  const payload = {
    cardId: params.cardId,
    valor: params.valor,
    cpf: params.cpf,
    parcelas: params.parcelas ?? 1,
    descricao: params.descricao,
    orderId: gerarOrderId(),
  };

  const res = await api.post('/user/pagamento/pagbank/checkout', payload);
  const data = (await res.data) as CheckoutResponse;

  if (!res || res.status !== 200 || !data?.checkoutUrl) {
    throw new Error(data?.mensagem || 'Não foi possível iniciar o checkout do PagBank');
  }

  window.location.href = data.checkoutUrl;
}
```

### Confirmar status após retorno

Recomendação: fazer polling por 30–90s, porque o webhook pode levar alguns segundos.

```ts
async function consultarStatus(orderId: string) {
  const res = await api.get(`/user/pagamento/pagbank/status/${encodeURIComponent(orderId)}`);
  return (await res.data) as { status: string };
}

export async function aguardarPagamento(orderId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90_000) {
    const { status } = await consultarStatus(orderId);
    if (status === 'PAID') return { status };
    await new Promise((r) => setTimeout(r, 3000));
  }

  return { status: 'TIMEOUT' };
}
```

## UX recomendado

- Pedir CPF antes de abrir o checkout (o backend exige).
- Permitir pagamento parcial (o backend valida contra o saldo).
- Mostrar estado “Aguardando confirmação...” ao retornar com `pagbank_callback`.
- Em caso de `TIMEOUT`, mostrar botão “Verificar novamente” (reconsulta status e recarrega consumo).

## Webhook (apenas referência)

O webhook é chamado pelo PagBank (não pelo frontend):

`POST /api/user/pagamento/pagbank/callback?token=...`

O token do webhook pode ser configurado por arena (Point). O frontend não precisa conhecer nenhum token.

