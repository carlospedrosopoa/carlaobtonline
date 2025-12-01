# Guia Completo: Integração com API da Meta (WhatsApp Business API)

Este guia explica passo a passo como configurar e usar a WhatsApp Business API da Meta no projeto.

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração no Meta Business](#configuração-no-meta-business)
3. [Instalação de Dependências](#instalação-de-dependências)
4. [Configuração de Variáveis de Ambiente](#configuração-de-variáveis-de-ambiente)
5. [Implementação do Código](#implementação-do-código)
6. [Testando a Integração](#testando-a-integração)
7. [Troubleshooting](#troubleshooting)

---

## 📌 Pré-requisitos

Antes de começar, você precisa:

1. **Conta Meta Business** (Facebook Business)
   - Acesse: https://business.facebook.com
   - Crie uma conta ou use uma existente

2. **Aplicativo no Meta for Developers**
   - Acesse: https://developers.facebook.com
   - Crie um novo aplicativo ou use um existente

3. **WhatsApp Business Account (WABA)**
   - Você precisará solicitar acesso à WhatsApp Business API
   - Pode levar alguns dias para aprovação

4. **Número de telefone verificado**
   - Número que será usado para enviar mensagens
   - Deve estar verificado no Meta Business

---

## 🔧 Configuração no Meta Business

### Passo 1: Criar Aplicativo no Meta for Developers

1. Acesse https://developers.facebook.com/apps/
2. Clique em **"Criar App"**
3. Escolha **"Business"** como tipo de aplicativo
4. Preencha os dados do aplicativo:
   - Nome do App
   - Email de contato
   - Finalidade do negócio

### Passo 2: Adicionar Produto WhatsApp

1. No painel do aplicativo, vá em **"Adicionar Produto"**
2. Procure por **"WhatsApp"** e clique em **"Configurar"**
3. Siga as instruções para configurar o WhatsApp Business API

### Passo 3: Obter Credenciais

Você precisará das seguintes informações:

1. **Access Token** (Token de Acesso)
   - Vá em **WhatsApp → API Setup**
   - Copie o **Temporary Access Token** (para testes)
   - Para produção, gere um **Permanent Access Token**

2. **Phone Number ID**
   - Encontrado em **WhatsApp → API Setup**
   - É o ID do número de telefone que enviará mensagens

3. **Business Account ID** (opcional, mas recomendado)
   - ID da sua conta comercial Meta

4. **App Secret** (opcional, para webhooks)
   - Em **Configurações → Básico**
   - Use para validar webhooks

5. **Webhook Verify Token** (para webhooks)
   - Crie um token aleatório para verificar webhooks
   - Exemplo: `meu_token_secreto_123`

### Passo 4: Configurar Webhook (Opcional)

Se quiser receber mensagens e status de entrega:

1. Em **WhatsApp → Configuração**
2. Clique em **"Configurar Webhook"**
3. URL do Webhook: `https://seu-dominio.com/api/whatsapp/webhook`
4. Token de Verificação: o token que você criou
5. Selecione os eventos:
   - `messages` - Receber mensagens
   - `message_status` - Status de entrega

---

## 📦 Instalação de Dependências

A API da Meta usa HTTP REST, então não precisa de biblioteca específica. Mas vamos instalar o `axios` para facilitar as requisições:

```bash
npm install axios
```

---

## 🔐 Configuração de Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env.local` (local) e no Vercel (produção):

```env
# WhatsApp Business API - Meta
META_WHATSAPP_ACCESS_TOKEN=seu_access_token_aqui
META_WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id_aqui
META_WHATSAPP_BUSINESS_ACCOUNT_ID=seu_business_account_id_aqui
META_WHATSAPP_APP_SECRET=seu_app_secret_aqui
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_token_aqui

# URL base da API (padrão: https://graph.facebook.com/v21.0)
META_WHATSAPP_API_VERSION=v21.0
```

### ⚠️ Importante

- **NUNCA** commite o arquivo `.env.local` no Git
- Use variáveis de ambiente no Vercel para produção
- O Access Token deve ser mantido em segredo

---

## 💻 Implementação do Código

O código já está preparado em `src/lib/whatsappService.ts`. Agora vamos implementar a integração real com a API da Meta.

### Estrutura da API da Meta

A WhatsApp Business API da Meta usa o Graph API:

- **Endpoint base**: `https://graph.facebook.com/v21.0`
- **Enviar mensagem**: `POST /{phone-number-id}/messages`
- **Headers necessários**:
  - `Authorization: Bearer {access-token}`
  - `Content-Type: application/json`

### Formato da Mensagem

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Sua mensagem aqui"
  }
}
```

---

## 🧪 Testando a Integração

### Teste Manual

Você pode testar enviando uma mensagem diretamente pela API:

```bash
curl -X POST "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5511999999999",
    "type": "text",
    "text": {
      "preview_url": false,
      "body": "Teste de mensagem"
    }
  }'
```

### Teste no Sistema

1. Crie um agendamento no sistema
2. Verifique se o gestor tem WhatsApp cadastrado
3. A mensagem deve ser enviada automaticamente

---

## 🔍 Troubleshooting

### Erro: "Invalid OAuth access token"

- Verifique se o Access Token está correto
- Tokens temporários expiram em 24 horas
- Gere um token permanente para produção

### Erro: "Invalid phone number"

- O número deve estar no formato internacional (ex: 5511999999999)
- O número deve estar verificado no Meta Business
- Verifique se o número está associado à sua conta

### Erro: "Rate limit exceeded"

- A API tem limites de taxa
- Aguarde alguns minutos antes de tentar novamente
- Considere implementar fila de mensagens

### Mensagens não estão sendo enviadas

1. Verifique os logs do console
2. Confirme que as variáveis de ambiente estão configuradas
3. Verifique se o número do gestor está cadastrado corretamente
4. Confirme que o Access Token tem permissões adequadas

---

## 📚 Recursos Adicionais

- **Documentação Oficial**: https://developers.facebook.com/docs/whatsapp
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer
- **Status da API**: https://developers.facebook.com/status
- **Suporte**: https://developers.facebook.com/support

---

## 🚀 Próximos Passos

Após a integração básica, você pode:

1. **Implementar Templates de Mensagem**
   - Mensagens pré-aprovadas pela Meta
   - Mais confiáveis e profissionais

2. **Adicionar Webhooks**
   - Receber confirmações de entrega
   - Receber mensagens dos clientes

3. **Implementar Fila de Mensagens**
   - Evitar rate limits
   - Melhorar confiabilidade

4. **Adicionar Mídia**
   - Enviar imagens, vídeos, documentos
   - Melhorar experiência do usuário

---

## ⚠️ Limitações e Considerações

1. **Custos**: A API da Meta pode ter custos por mensagem após o período gratuito
2. **Aprovação**: Pode levar tempo para aprovar sua conta
3. **Rate Limits**: Há limites de mensagens por segundo/minuto
4. **Templates**: Para mensagens iniciadas pelo sistema, você precisa usar templates aprovados
5. **Janela de 24 horas**: Você só pode enviar mensagens livres dentro de 24h após o cliente enviar uma mensagem

---

## 📝 Notas Finais

- Sempre teste em ambiente de desenvolvimento primeiro
- Mantenha suas credenciais seguras
- Monitore os logs para identificar problemas
- Considere implementar retry logic para falhas temporárias
- Documente qualquer configuração específica do seu projeto






