# Configuração Infinite Pay

## Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis de ambiente no seu `.env`:

```env
# Handle da conta Infinite Pay (fornecido pela Infinite Pay)
INFINITE_PAY_HANDLE=seu_handle_aqui

# URL base do app (para callback)
NEXT_PUBLIC_APP_URL=https://appatleta.playnaquadra.com.br

# CPF padrão para testes (opcional - em produção deve vir do perfil do usuário)
INFINITE_PAY_DEFAULT_DOC=00000000000
```

## Migration

Execute a migration para criar a tabela de pagamentos:

```sql
-- Execute o arquivo:
migrations/create_pagamento_infinite_pay.sql
```

## Como Funciona

1. **Usuário clica em "Pagar com Infinite Pay"** em um card de consumo aberto
2. **Sistema gera um DeepLink** do Infinite Pay com os dados do pagamento
3. **Usuário é redirecionado** para o app Infinite Pay
4. **Usuário completa o pagamento** no app Infinite Pay
5. **Infinite Pay retorna** para o app via callback
6. **Sistema atualiza** o card de consumo com o pagamento

## Estrutura de Dados

### Tabela PagamentoInfinitePay
- Armazena pagamentos processados via Infinite Pay
- Status: PENDING, APPROVED, REJECTED, CANCELLED
- Vinculado ao CardCliente e ao PagamentoCard (quando aprovado)

### Campos Adicionados em PagamentoCard
- `infinitePayOrderId`: ID da ordem no Infinite Pay
- `infinitePayTransactionId`: ID da transação retornado pelo Infinite Pay

## Próximos Passos

1. **Adicionar campo CPF no perfil do usuário/atleta** (atualmente usa variável de ambiente)
2. **Configurar webhook do Infinite Pay** para receber callbacks automaticamente
3. **Implementar retry logic** para verificar status de pagamentos pendentes
4. **Adicionar logs** para auditoria de pagamentos

