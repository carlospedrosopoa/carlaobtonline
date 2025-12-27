# Postman - Recuperação de Senha

## Variáveis de Ambiente

Configure as seguintes variáveis no Postman:

- `base_url`: `https://carlaobtonline.vercel.app` (ou `http://localhost:3000` para desenvolvimento)
- `email_teste`: Email de um usuário cadastrado para testar
- `token_reset`: Será preenchido automaticamente após solicitar recuperação (em desenvolvimento)

## Requisições

### 1. Solicitar Recuperação de Senha (Esqueci Minha Senha)

**Método:** `POST`  
**URL:** `{{base_url}}/api/user/auth/forgot-password`  
**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "{{email_teste}}"
}
```

**Resposta de Sucesso (200):**
```json
{
  "mensagem": "Link de recuperação enviado via WhatsApp! Verifique suas mensagens.",
  "sucesso": true,
  "enviadoViaWhatsApp": true
}
```

**Resposta em Desenvolvimento (200):**
```json
{
  "mensagem": "Link de recuperação enviado via WhatsApp! Verifique suas mensagens.",
  "sucesso": true,
  "enviadoViaWhatsApp": true,
  "resetUrl": "https://atleta.playnaquadra.com.br/resetar-senha?token=abc123...",
  "token": "abc123..."
}
```

**Notas:**
- Em desenvolvimento, a resposta inclui `resetUrl` e `token` para facilitar testes
- Se o usuário tiver telefone cadastrado e Gzappy configurado, o link será enviado via WhatsApp
- O token expira em 1 hora

---

### 2. Redefinir Senha com Token

**Método:** `POST`  
**URL:** `{{base_url}}/api/user/auth/reset-password`  
**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "token": "{{token_reset}}",
  "password": "novaSenha123"
}
```

**Resposta de Sucesso (200):**
```json
{
  "mensagem": "Senha redefinida com sucesso! Você já pode fazer login com a nova senha.",
  "sucesso": true
}
```

**Resposta de Erro - Token Inválido (400):**
```json
{
  "mensagem": "Token inválido ou expirado. Solicite uma nova recuperação de senha."
}
```

**Resposta de Erro - Senha Muito Curta (400):**
```json
{
  "mensagem": "A senha deve ter no mínimo 6 caracteres."
}
```

**Notas:**
- O token deve ser válido e não expirado (válido por 1 hora)
- A senha deve ter no mínimo 6 caracteres
- Após o reset, o token é invalidado (não pode ser usado novamente)

---

## Fluxo Completo de Teste

1. **Solicitar Recuperação:**
   - Faça a requisição 1 com um email cadastrado
   - Em desenvolvimento, copie o `token` da resposta
   - Configure a variável `token_reset` no Postman com o token copiado

2. **Redefinir Senha:**
   - Faça a requisição 2 com o token e uma nova senha
   - Verifique se a resposta indica sucesso

3. **Testar Login:**
   - Use a nova senha para fazer login normalmente
   - Verifique se o login funciona

---

## Exemplos de Teste

### Teste 1: Solicitar Recuperação (Sucesso)
```bash
curl -X POST https://carlaobtonline.vercel.app/api/user/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@exemplo.com"
  }'
```

### Teste 2: Redefinir Senha (Sucesso)
```bash
curl -X POST https://carlaobtonline.vercel.app/api/user/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token_gerado_aqui",
    "password": "novaSenha123"
  }'
```

### Teste 3: Token Expirado (Erro)
```bash
curl -X POST https://carlaobtonline.vercel.app/api/user/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token_expirado_ou_invalido",
    "password": "novaSenha123"
  }'
```

---

## Códigos de Status HTTP

- `200`: Sucesso
- `400`: Erro na requisição (dados inválidos, token inválido, etc)
- `500`: Erro interno do servidor

---

## Observações Importantes

1. **Segurança:**
   - Por segurança, sempre retorna sucesso mesmo se o email não existir
   - Isso previne enumeração de emails cadastrados

2. **WhatsApp:**
   - O link só é enviado via WhatsApp se:
     - O usuário tiver telefone cadastrado (`Atleta.fone`)
     - O Gzappy estiver configurado (via `pointId` ou variáveis de ambiente)

3. **Token:**
   - Token válido por 1 hora
   - Token é único e aleatório (32 bytes)
   - Token é invalidado após uso

4. **Desenvolvimento:**
   - Em desenvolvimento, o token aparece na resposta para facilitar testes
   - Em produção, o token não aparece na resposta

