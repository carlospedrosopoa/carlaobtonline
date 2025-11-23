# Variáveis de Ambiente

Este documento lista todas as variáveis de ambiente necessárias para o projeto.

## 📋 Variáveis Obrigatórias

### Banco de Dados
```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/carlaobtonline
```

### Autenticação JWT
```env
JWT_SECRET=sua-chave-secreta-jwt-aqui
```
**Como gerar:** Execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📱 Variáveis para WhatsApp Business API (Meta)

### Obrigatórias para envio de mensagens:
```env
META_WHATSAPP_ACCESS_TOKEN=seu_access_token_aqui
META_WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id_aqui
```

### Opcionais (mas recomendadas):
```env
META_WHATSAPP_BUSINESS_ACCOUNT_ID=seu_business_account_id_aqui
META_WHATSAPP_APP_SECRET=seu_app_secret_aqui
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_token_aqui
META_WHATSAPP_API_VERSION=v21.0
```

**Onde obter:** Veja o guia completo em `GUIA_API_META.md`

---

## 🔧 Variáveis Opcionais

### API URL (padrão: /api)
```env
NEXT_PUBLIC_API_URL=/api
```

---

## 📝 Como Configurar

### Desenvolvimento Local

1. Crie um arquivo `.env.local` na raiz do projeto
2. Copie as variáveis acima e preencha com seus valores
3. O arquivo `.env.local` já está no `.gitignore` e não será commitado

### Produção (Vercel)

1. Acesse o painel do Vercel
2. Vá em **Settings → Environment Variables**
3. Adicione cada variável uma por uma
4. Após adicionar, faça um **Redeploy** para aplicar as mudanças

---

## ⚠️ Importante

- **NUNCA** commite arquivos `.env` ou `.env.local` no Git
- Mantenha suas credenciais em segredo
- Use variáveis diferentes para desenvolvimento e produção
- Revise periodicamente as credenciais e remova as que não são mais usadas

---

## 📚 Documentação Relacionada

- `GUIA_API_META.md` - Guia completo de integração com API da Meta
- `README.md` - Instruções gerais do projeto


