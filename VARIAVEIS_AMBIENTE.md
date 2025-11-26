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

### CORS (para frontend externo)
```env
# Em desenvolvimento, localhost é permitido automaticamente
# Em produção, configure no Vercel
ALLOWED_ORIGINS=https://frontend1.vercel.app,https://frontend2.com
```

### Google Cloud Storage (opcional - para upload de imagens)
```env
# Opção 1: Para desenvolvimento local (usar arquivo de credenciais)
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json

# Opção 2: Para produção no Vercel (usar chave em base64)
# GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
# GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
# GOOGLE_CLOUD_KEY=<base64-encoded-service-account-key>
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

1. **Crie um arquivo `.env.local` na raiz do projeto** (não existe ainda - você precisa criar)
2. Copie as variáveis do exemplo abaixo e preencha com seus valores reais
3. O arquivo `.env.local` já está no `.gitignore` e não será commitado

**Exemplo de `.env.local`:**
```env
# Database
DATABASE_URL=postgresql://usuario:senha@localhost:5432/carlaobtonline

# JWT Secret
JWT_SECRET=sua-chave-secreta-jwt-aqui

# CORS (opcional em desenvolvimento - localhost já é permitido)
# ALLOWED_ORIGINS=http://localhost:3001

# Google Cloud Storage (opcional - para upload de imagens)
# GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
# GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
# GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

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





