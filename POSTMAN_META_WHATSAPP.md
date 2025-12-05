# 📱 Guia Postman: API Direta do WhatsApp Business (Meta)

Este guia mostra como testar diretamente a API do WhatsApp Business da Meta usando o Postman, sem passar pelo nosso sistema.

## 📋 Pré-requisitos

- Postman instalado
- **Access Token** do WhatsApp Business API (App Token / Permanent Token)
- **Phone Number ID** (não é o número de telefone!)
- Número de telefone verificado no Meta Business

---

## 🔧 1. Configuração Inicial

### Importar Collection

1. Abra o Postman
2. Clique em **Import**
3. Selecione o arquivo `Meta_WhatsApp_API.postman_collection.json`
4. A collection será importada com 8 requisições prontas

### Configurar Variáveis de Ambiente

1. Clique no ícone de **engrenagem** (⚙️) no canto superior direito
2. Clique em **Add** para criar um novo ambiente (ex: "Meta WhatsApp")
3. Configure as seguintes variáveis:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `access_token` | `EAAxxxxxxxxxxxxx` | Seu Access Token (App Token/Permanent Token) |
| `phone_number_id` | `123456789012345` | Phone Number ID (não é o número de telefone!) |
| `api_version` | `v21.0` | Versão da API (padrão: v21.0) |
| `business_account_id` | `123456789012345` | Business Account ID (opcional) |
| `destinatario` | `5511999999999` | Número do destinatário para testes |

4. Selecione o ambiente criado no dropdown no canto superior direito

---

## 📤 2. Requisições Disponíveis

### 1. Enviar Mensagem de Texto

**Endpoint:** `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Olá! Esta é uma mensagem de teste."
  }
}
```

**Resposta de Sucesso (200):**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "5511999999999",
      "wa_id": "5511999999999"
    }
  ],
  "messages": [
    {
      "id": "wamid.xxxxx"
    }
  ]
}
```

---

### 2. Enviar Mensagem com Preview de Link

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Confira nosso site: https://www.exemplo.com.br"
  }
}
```

---

### 3. Enviar Mensagem Formatada

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "📋 *Card #123*\n\n👤 *Cliente:* João Silva\n📅 *Data:* 15/01/2024\n💰 *Valor:* R$ 150,00"
  }
}
```

**Formatação WhatsApp:**
- `*texto*` = **negrito**
- `_texto_` = _itálico_
- `~texto~` = ~~riscado~~
- ````texto``` = monoespaçado

---

### 4. Enviar Template Aprovado

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "pt_BR"
    }
  }
}
```

**⚠️ IMPORTANTE:** 
- O template deve estar aprovado pela Meta
- Use apenas templates que você criou e foram aprovados
- Substitua `hello_world` pelo nome do seu template

---

### 5. Enviar Template com Parâmetros

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "nome_do_template",
    "language": {
      "code": "pt_BR"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "João Silva"
          },
          {
            "type": "text",
            "text": "R$ 150,00"
          }
        ]
      }
    ]
  }
}
```

---

### 6. Verificar Status do Número

**Endpoint:** `GET https://graph.facebook.com/v21.0/{phone_number_id}?fields=verified_name,display_phone_number,quality_rating`

**Resposta:**
```json
{
  "verified_name": "Nome da Empresa",
  "display_phone_number": "+55 11 99999-9999",
  "quality_rating": "GREEN"
}
```

---

### 7. Listar Templates Aprovados

**Endpoint:** `GET https://graph.facebook.com/v21.0/{business_account_id}/message_templates`

**Resposta:**
```json
{
  "data": [
    {
      "name": "hello_world",
      "language": "pt_BR",
      "status": "APPROVED",
      "category": "MARKETING"
    }
  ]
}
```

---

### 8. Verificar Webhook

**Endpoint:** `GET https://graph.facebook.com/v21.0/{phone_number_id}/subscribed_apps`

---

## 🔐 3. Como Obter as Credenciais

### Access Token

1. Acesse: https://business.facebook.com
2. Vá em: **WhatsApp → API Setup**
3. Procure por: **"System User Token"** ou **"Permanent Token"**
4. Clique em: **"Generate Token"** ou **"Criar Token"**
5. Selecione as permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Copie o token (começa com "EAA..." e é muito longo)

### Phone Number ID

1. Acesse: https://business.facebook.com
2. Vá em: **WhatsApp → API Setup**
3. Procure por: **"Phone number ID"** ou **"From"**
4. Copie o ID numérico (geralmente 15-17 dígitos)
5. ⚠️ **NÃO é o número de telefone em si!**

### Business Account ID

1. Acesse: https://business.facebook.com
2. Vá em: **Configurações → Informações da Conta**
3. O ID está na URL ou nas informações da conta

---

## 🧪 4. Testando

### Passo a Passo

1. **Configure as variáveis** no Postman (veja seção 1)
2. **Selecione o ambiente** no dropdown
3. **Execute a requisição** "1. Enviar Mensagem de Texto"
4. **Verifique a resposta** - deve retornar status 200 com `message_id`

### Exemplo de Teste Rápido

1. Abra a requisição "1. Enviar Mensagem de Texto"
2. Verifique se as variáveis estão configuradas:
   - `{{access_token}}` → Seu token
   - `{{phone_number_id}}` → Seu Phone Number ID
   - `{{destinatario}}` → Número para teste
3. Clique em **Send**
4. Se funcionar, você receberá a mensagem no WhatsApp!

---

## 🐛 5. Troubleshooting

### Erro: "Invalid OAuth access token"

- Verifique se o Access Token está correto
- Certifique-se de usar um **App Token** (Permanent Token), não User Token
- Tokens temporários expiram em 24 horas

### Erro: "Object with ID '...' does not exist"

- Verifique se o **Phone Number ID** está correto
- ⚠️ Você não está usando o número de telefone no lugar do Phone Number ID?
- O Phone Number ID é diferente do número de telefone

### Erro: "Invalid parameter"

- Verifique o formato do número do destinatário
- Deve estar no formato internacional: `5511999999999` (apenas números)
- Não use espaços, parênteses ou hífens

### Erro: "Message undeliverable"

- O número pode estar bloqueado
- O número pode não ter WhatsApp
- Verifique se o número está correto

### Erro: "Rate limit exceeded"

- Você excedeu o limite de mensagens por segundo/minuto
- Aguarde alguns minutos antes de tentar novamente
- Considere implementar uma fila de mensagens

---

## 📚 6. Recursos Adicionais

- **Documentação Oficial**: https://developers.facebook.com/docs/whatsapp
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer
- **Status da API**: https://developers.facebook.com/status
- **Suporte**: https://developers.facebook.com/support

---

## 💡 7. Dicas

1. **Teste primeiro com seu próprio número** para verificar se está funcionando
2. **Use mensagens curtas** inicialmente para evitar problemas
3. **Mantenha o token seguro** - não compartilhe em repositórios públicos
4. **Monitore os logs** da API para identificar problemas
5. **Use templates aprovados** para mensagens iniciadas pelo sistema (fora da janela de 24h)

---

## ⚠️ 8. Limitações Importantes

1. **Janela de 24 horas**: Você só pode enviar mensagens livres dentro de 24h após o cliente enviar uma mensagem
2. **Templates obrigatórios**: Para mensagens iniciadas pelo sistema (fora da janela), você precisa usar templates aprovados
3. **Rate Limits**: Há limites de mensagens por segundo/minuto
4. **Custos**: Pode haver custos por mensagem após o período gratuito
5. **Aprovação**: Templates precisam ser aprovados pela Meta antes de usar

---

## 🎯 9. Exemplo Completo de Requisição

```http
POST https://graph.facebook.com/v21.0/123456789012345/messages HTTP/1.1
Host: graph.facebook.com
Authorization: Bearer EAAxxxxxxxxxxxxx
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Olá! Esta é uma mensagem de teste."
  }
}
```

---

**Pronto para testar diretamente a API da Meta!** 🚀

