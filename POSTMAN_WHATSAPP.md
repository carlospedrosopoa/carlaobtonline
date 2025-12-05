# 📱 Guia Postman: Enviar Mensagem WhatsApp

Este guia mostra como testar o envio de mensagens WhatsApp usando o Postman.

## 📋 Pré-requisitos

- Postman instalado
- Servidor rodando localmente (`npm run dev`)
- Usuário autenticado (ADMIN ou ORGANIZER)
- Arena configurada com credenciais WhatsApp no sistema

---

## 🔐 1. Autenticação

Primeiro, você precisa fazer login para obter o token JWT.

### Configuração da Requisição de Login

**Método:** `POST`  
**URL:** `http://localhost:3000/api/auth/login`

### Headers
```
Content-Type: application/json
```

### Body (raw JSON)
```json
{
  "email": "seu-email@exemplo.com",
  "password": "sua-senha"
}
```

### Resposta de Sucesso (200)
```json
{
  "usuario": {
    "id": "uuid-do-usuario",
    "name": "Nome do Usuário",
    "email": "seu-email@exemplo.com",
    "role": "ADMIN"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**⚠️ IMPORTANTE:** Copie o `accessToken` da resposta para usar nas próximas requisições!

---

## 📤 2. Enviar Mensagem WhatsApp

### Configuração da Requisição

**Método:** `POST`  
**URL:** `http://localhost:3000/api/whatsapp/enviar`

### Headers
```
Content-Type: application/json
Authorization: Bearer {seu-access-token-aqui}
```

**Exemplo:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsIm5hbWUiOiJKb2FvIiwiZW1haWwiOiJqb2FvQGV4ZW1wbG8uY29tIiwicm9sZSI6IkFETUlOIn0.abc123...
```

### Body (raw JSON)

#### Exemplo 1: Enviar para número específico (sem pointId)
```json
{
  "destinatario": "5511999999999",
  "mensagem": "Olá! Esta é uma mensagem de teste do sistema.",
  "tipo": "texto"
}
```

#### Exemplo 2: Enviar usando credenciais de uma arena específica
```json
{
  "destinatario": "5511999999999",
  "mensagem": "Olá! Esta é uma mensagem de teste do sistema.",
  "tipo": "texto",
  "pointId": "uuid-da-arena-aqui"
}
```

#### Exemplo 3: Mensagem formatada (com emojis e formatação)
```json
{
  "destinatario": "5511999999999",
  "mensagem": "📋 *Card #123*\n\n👤 *Cliente:* João Silva\n📅 *Data:* 15/01/2024 14:30\n💰 *Valor Total:* R$ 150,00",
  "tipo": "texto"
}
```

### Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `destinatario` | string | ✅ Sim | Número de telefone do destinatário (formato: apenas números, ex: `5511999999999`) |
| `mensagem` | string | ✅ Sim | Texto da mensagem (máximo 4096 caracteres) |
| `tipo` | string | ❌ Não | Tipo da mensagem: `"texto"` (padrão) ou `"template"` |
| `pointId` | string | ❌ Não | ID da arena para usar credenciais específicas. Se não fornecido, usa credenciais do usuário ORGANIZER ou variáveis de ambiente |

### Resposta de Sucesso (200)
```json
{
  "sucesso": true,
  "mensagem": "Mensagem enviada com sucesso",
  "destinatario": "5511999999999"
}
```

### Respostas de Erro

#### 401 - Não autenticado
```json
{
  "mensagem": "Não autenticado"
}
```

#### 403 - Sem permissão
```json
{
  "mensagem": "Apenas administradores e organizadores podem enviar mensagens WhatsApp"
}
```

#### 400 - Dados inválidos
```json
{
  "mensagem": "Destinatário e mensagem são obrigatórios"
}
```

ou

```json
{
  "mensagem": "Token de acesso WhatsApp inválido: token está vazio ou contém apenas espaços. Verifique as configurações da arena.",
  "detalhes": "Verifique se o Access Token está correto e não expirou nas configurações da arena."
}
```

#### 500 - Erro ao enviar
```json
{
  "mensagem": "Erro ao enviar mensagem WhatsApp. Verifique as configurações da arena e os logs do servidor."
}
```

---

## 🧪 3. Exemplos Práticos

### Exemplo: Enviar mensagem de card de cliente

```json
{
  "destinatario": "5511983053363",
  "mensagem": "📋 *Card #123*\n\n👤 *Cliente:* João Silva\n📅 *Data:* 15/01/2024 14:30\n📊 *Status:* Aberto\n\n💰 *Valores:*\n• Total: R$ 150,00\n• Pago: R$ 50,00\n• Saldo: R$ 100,00",
  "tipo": "texto",
  "pointId": "uuid-da-arena"
}
```

### Exemplo: Mensagem simples

```json
{
  "destinatario": "5511999999999",
  "mensagem": "Olá! Esta é uma mensagem de teste.",
  "tipo": "texto"
}
```

---

## 🔧 4. Configuração no Postman

### Opção 1: Usando a aba Authorization (Recomendado)

1. Na requisição, vá para a aba **Authorization**
2. Selecione **Type: Bearer Token**
3. Cole o token JWT no campo **Token**
4. O Postman automaticamente adiciona o header `Authorization: Bearer <token>`

### Opção 2: Manualmente no Header

1. Vá para a aba **Headers**
2. Adicione:
   - **Key**: `Authorization`
   - **Value**: `Bearer {seu-token-jwt-aqui}`

---

## 📝 5. Variáveis de Ambiente (Opcional)

Para facilitar os testes, você pode criar variáveis de ambiente no Postman:

1. Clique no ícone de **engrenagem** (⚙️) no canto superior direito
2. Clique em **Add** para criar um novo ambiente
3. Adicione as variáveis:
   - `base_url`: `http://localhost:3000`
   - `access_token`: `{cole-o-token-após-login}`
   - `point_id`: `{uuid-da-arena}`

4. Use nas requisições:
   - URL: `{{base_url}}/api/whatsapp/enviar`
   - Token: `{{access_token}}`

---

## 🐛 6. Troubleshooting

### Erro: "Token de acesso WhatsApp inválido"

- Verifique se o Access Token está correto nas configurações da arena
- Certifique-se de que o token não expirou
- Use um **App Token** (Permanent Token), não um User Token

### Erro: "Phone Number ID inválido"

- O Phone Number ID não é o número de telefone em si
- Encontre o Phone Number ID em **WhatsApp → API Setup** no Meta Business Suite
- É um número diferente (geralmente 15-17 dígitos)

### Erro: "Object with ID '...' does not exist"

- Verifique se o Phone Number ID está correto
- Certifique-se de que o número está verificado no Meta Business
- Confirme que o Access Token tem as permissões necessárias

### Mensagem não está sendo enviada

1. Verifique os logs do console do servidor
2. Confirme que as credenciais WhatsApp estão configuradas na arena
3. Verifique se o número do destinatário está no formato correto (apenas números, código do país)
4. Teste o token diretamente na API da Meta usando Graph API Explorer

---

## 🔗 7. Links Úteis

- **Graph API Explorer**: https://developers.facebook.com/tools/explorer
- **Documentação WhatsApp API**: https://developers.facebook.com/docs/whatsapp
- **Meta Business Suite**: https://business.facebook.com

---

## 📋 8. Checklist Antes de Testar

- [ ] Servidor rodando (`npm run dev`)
- [ ] Login realizado e token JWT copiado
- [ ] Arena configurada com credenciais WhatsApp no sistema
- [ ] Access Token válido (App Token/Permanent Token)
- [ ] Phone Number ID correto (não é o número de telefone)
- [ ] Número do destinatário no formato correto (ex: `5511999999999`)

---

## 💡 Dicas

1. **Teste primeiro com um número seu** para verificar se está funcionando
2. **Use mensagens curtas** inicialmente para evitar problemas de formatação
3. **Verifique os logs do servidor** para ver mensagens de erro detalhadas
4. **Mantenha o token seguro** - não compartilhe em repositórios públicos
5. **Use variáveis de ambiente** no Postman para facilitar os testes

---

## 🎯 Exemplo Completo de Requisição

```http
POST http://localhost:3000/api/whatsapp/enviar HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsIm5hbWUiOiJKb2FvIiwiZW1haWwiOiJqb2FvQGV4ZW1wbG8uY29tIiwicm9sZSI6IkFETUlOIn0.abc123...

{
  "destinatario": "5511999999999",
  "mensagem": "Olá! Esta é uma mensagem de teste do sistema.",
  "tipo": "texto",
  "pointId": "uuid-da-arena-opcional"
}
```

---

**Pronto para testar!** 🚀

