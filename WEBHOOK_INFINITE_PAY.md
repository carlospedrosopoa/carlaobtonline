# Configuração do Webhook Infinite Pay

## O que é o Webhook?

O webhook é uma URL que o Infinite Pay chama automaticamente quando um pagamento é aprovado. É uma comunicação **server-to-server** (servidor do Infinite Pay → nosso servidor).

## O que já está implementado?

✅ **Rota do webhook**: `/api/user/pagamento/infinite-pay/callback`
- Rota pública (sem autenticação) - necessário para o Infinite Pay poder chamar
- Suporta requisições POST (webhook) e OPTIONS (preflight)
- CORS configurado para aceitar requisições sem origem (server-to-server)
- Processa o pagamento e atualiza o card automaticamente

✅ **Lógica de processamento**:
- Recebe os dados do pagamento do Infinite Pay
- Atualiza o status do pagamento na tabela `PagamentoInfinitePay`
- Cria o registro de pagamento na tabela `PagamentoCard`
- Fecha o card automaticamente se o saldo estiver quitado
- Registra informações detalhadas nas observações do pagamento

✅ **URL do webhook gerada automaticamente**:
- Usa `NEXT_PUBLIC_API_URL` se configurada
- Fallback para `VERCEL_URL` (URL do deployment no Vercel)
- Fallback final para URL de produção fixa

## O que precisa ser configurado?

### 1. Variável de Ambiente no Vercel (carlaobtonline)

**Variável**: `NEXT_PUBLIC_API_URL`
**Valor**: `https://carlaobtonline.vercel.app/api`

**Como configurar**:
1. Acesse o Vercel → Projeto `carlaobtonline` → Settings → Environment Variables
2. Adicione ou edite a variável `NEXT_PUBLIC_API_URL`
3. Valor: `https://carlaobtonline.vercel.app/api`
4. Aplique para: Production, Preview, Development

**Por quê?**
- Garante que a URL do webhook seja sempre a URL correta do backend
- Evita problemas com URLs de preview/deployment temporários

### 2. URL do Webhook deve ser acessível publicamente

A URL do webhook será:
```
https://carlaobtonline.vercel.app/api/user/pagamento/infinite-pay/callback
```

**Teste manual**:
```bash
# Teste se a rota está acessível (deve retornar erro 400, mas não 404)
curl -X POST https://carlaobtonline.vercel.app/api/user/pagamento/infinite-pay/callback \
  -H "Content-Type: application/json" \
  -d '{"order_nsu": "test"}'
```

**Resposta esperada**: `400 Bad Request` com mensagem "order_nsu é obrigatório" ou "Pagamento não encontrado"
- ✅ Se retornar 400: Rota está funcionando
- ❌ Se retornar 404: Rota não existe (verificar deploy)
- ❌ Se retornar 401/403: Rota está protegida (remover autenticação)

### 3. Configuração no Infinite Pay (Dashboard)

**IMPORTANTE**: O Infinite Pay pode exigir que você configure a URL do webhook no dashboard deles.

**Passos**:
1. Acesse o dashboard do Infinite Pay
2. Vá em Configurações → Webhooks
3. Adicione a URL: `https://carlaobtonline.vercel.app/api/user/pagamento/infinite-pay/callback`
4. Configure o método: POST
5. Salve as configurações

**Nota**: Alguns gateways de pagamento permitem configurar a URL do webhook por transação (via parâmetro `webhook_url` no checkout), o que já estamos fazendo. Mas alguns também exigem uma URL padrão no dashboard.

### 4. Verificar logs no Vercel

Após um pagamento, verifique os logs no Vercel para confirmar que o webhook foi chamado:

**Logs esperados**:
```
[INFINITE PAY WEBHOOK] Recebendo webhook...
[INFINITE PAY WEBHOOK] URL: ...
[INFINITE PAY WEBHOOK] Origin: ...
[INFINITE PAY WEBHOOK] Dados recebidos: ...
[INFINITE PAY WEBHOOK] Pagamento processado com sucesso para order_nsu: ...
```

**Como verificar**:
1. Vercel → Projeto `carlaobtonline` → Logs
2. Filtre por "INFINITE PAY WEBHOOK"
3. Verifique se há requisições POST para `/api/user/pagamento/infinite-pay/callback`

## Como funciona o fluxo completo?

1. **Atleta clica em "Pagar Agora!"** no appatleta
2. **Frontend chama** `/api/user/pagamento/infinite-pay/checkout` (carlaobtonline)
3. **Backend gera checkout URL** do Infinite Pay com:
   - `redirect_url`: URL do frontend para redirecionar após pagamento
   - `webhook_url`: URL do backend para receber notificação
4. **Atleta é redirecionado** para o checkout do Infinite Pay
5. **Atleta completa o pagamento** no Infinite Pay
6. **Infinite Pay chama o webhook** (POST para `webhook_url`)
7. **Backend processa o pagamento**:
   - Atualiza `PagamentoInfinitePay` com status APPROVED
   - Cria `PagamentoCard` com os dados do pagamento
   - Fecha o card se saldo estiver quitado
8. **Backend responde 200 OK** para o Infinite Pay
9. **Atleta é redirecionado** para o frontend (via `redirect_url`)
10. **Frontend verifica status** do pagamento (polling ou callback)

## Troubleshooting

### Webhook não está sendo chamado

**Possíveis causas**:
1. URL do webhook incorreta no checkout
2. Infinite Pay não consegue acessar a URL (firewall, CORS, etc.)
3. URL não configurada no dashboard do Infinite Pay (se exigido)

**Solução**:
- Verificar logs do checkout para ver a URL gerada
- Testar a URL manualmente (curl)
- Verificar se há firewall bloqueando requisições do Infinite Pay

### Webhook retorna erro 400/500

**Possíveis causas**:
1. Dados do webhook estão incorretos
2. `order_nsu` não encontrado no banco
3. Erro ao processar pagamento

**Solução**:
- Verificar logs detalhados no Vercel
- Verificar se o `order_nsu` existe na tabela `PagamentoInfinitePay`
- Verificar estrutura dos dados recebidos do Infinite Pay

### CORS bloqueando o webhook

**Solução**: Já está configurado para aceitar requisições sem origem (server-to-server). Se ainda houver problemas, verificar se o Infinite Pay está enviando headers CORS incorretos.

## Checklist de Configuração

- [ ] Variável `NEXT_PUBLIC_API_URL` configurada no Vercel (carlaobtonline)
- [ ] URL do webhook acessível publicamente (teste com curl)
- [ ] URL do webhook configurada no dashboard do Infinite Pay (se exigido)
- [ ] Logs do Vercel mostrando requisições do webhook
- [ ] Pagamentos sendo processados corretamente após aprovação

## URLs Importantes

- **Webhook URL**: `https://carlaobtonline.vercel.app/api/user/pagamento/infinite-pay/callback`
- **Checkout URL**: Gerada dinamicamente pelo Infinite Pay
- **Redirect URL**: `https://appatleta.playnaquadra.com.br/app/atleta/consumo?payment_callback={orderId}`

