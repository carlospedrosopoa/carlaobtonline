# Configuração Infinite Pay

## Configuração por Arena

Cada arena pode ter sua própria conta Infinite Pay. O handle é configurado individualmente na administração de cada arena.

## Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis de ambiente no seu `.env`:

```env
# URL base do app (para callback)
NEXT_PUBLIC_APP_URL=https://appatleta.playnaquadra.com.br

# CPF padrão para testes (opcional - em produção deve vir do perfil do usuário)
INFINITE_PAY_DEFAULT_DOC=00000000000
```

**Nota:** O `INFINITE_PAY_HANDLE` não é mais uma variável de ambiente global. Cada arena deve configurar seu próprio handle na interface de administração.

## Migrations

Execute as migrations na seguinte ordem:

```sql
-- 1. Criar tabela de pagamentos Infinite Pay
migrations/create_pagamento_infinite_pay.sql

-- 2. Adicionar campo infinitePayHandle na tabela Point
migrations/add_infinite_pay_point.sql
```

## Como Funciona

1. **Arena configura seu handle Infinite Pay** na interface de administração
2. **Usuário clica em "Pagar com Infinite Pay"** em um card de consumo aberto
3. **Sistema busca o handle da arena** associada ao card
4. **Sistema gera um DeepLink** do Infinite Pay com os dados do pagamento usando o handle da arena
5. **Usuário é redirecionado** para o app Infinite Pay
6. **Usuário completa o pagamento** no app Infinite Pay
7. **Infinite Pay retorna** para o app via callback
8. **Sistema atualiza** o card de consumo com o pagamento

## Configuração do Handle por Arena

1. Acesse a página de administração de estabelecimentos
2. Edite a arena desejada
3. Na seção "Infinite Pay", informe o handle da sua conta Infinite Pay
4. Salve as alterações

**Importante:** Se uma arena não tiver o handle configurado, os atletas não conseguirão pagar cards dessa arena via Infinite Pay.

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

