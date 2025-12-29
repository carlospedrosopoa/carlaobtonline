# Postman - Login de Professor

## Variáveis de Ambiente

Configure as seguintes variáveis no Postman:

- `base_url`: `https://carlaobtonline.vercel.app` (ou `http://localhost:3000` para desenvolvimento)
- `email_professor`: Email de um professor cadastrado para testar
- `senha_professor`: Senha do professor
- `token_professor`: Será preenchido automaticamente após login bem-sucedido

## Requisição de Login

### Login de Professor

**Método:** `POST`  
**URL:** `{{base_url}}/api/auth/login`  
**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "{{email_professor}}",
  "password": "{{senha_professor}}"
}
```

**Resposta de Sucesso (200):**
```json
{
  "usuario": {
    "id": "uuid-do-usuario",
    "nome": "Nome do Professor",
    "email": "professor@exemplo.com",
    "role": "PROFESSOR",
    "professorId": "uuid-do-professor"
  },
  "user": {
    "id": "uuid-do-usuario",
    "nome": "Nome do Professor",
    "email": "professor@exemplo.com",
    "role": "PROFESSOR",
    "professorId": "uuid-do-professor"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta de Erro - Email/Senha Inválidos (401):**
```json
{
  "mensagem": "Usuário não encontrado"
}
```
ou
```json
{
  "mensagem": "Senha incorreta"
}
```

**Resposta de Erro - Perfil Não Permitido (403):**
```json
{
  "mensagem": "Acesso negado. Apenas administradores e gestores de arena podem acessar esta plataforma."
}
```

**Resposta de Erro - Dados Faltando (400):**
```json
{
  "mensagem": "Informe email e senha."
}
```

**Resposta de Erro - Erro Interno (500):**
```json
{
  "mensagem": "Erro ao efetuar login",
  "error": "Mensagem de erro detalhada"
}
```

---

## Uso do Token

Após o login bem-sucedido, use o token retornado no campo `token` para autenticar requisições subsequentes:

**Headers para Requisições Autenticadas:**
```
Authorization: Bearer {{token_professor}}
Content-Type: application/json
```

---

## Exemplo de Teste com cURL

### Login de Professor (Sucesso)
```bash
curl -X POST https://carlaobtonline.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "professor@exemplo.com",
    "password": "senha123"
  }'
```

### Login de Professor com Token (Requisição Autenticada)
```bash
curl -X GET https://carlaobtonline.vercel.app/api/professor/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

---

## Códigos de Status HTTP

- `200`: Login bem-sucedido
- `400`: Dados inválidos (email ou senha faltando)
- `401`: Credenciais inválidas (usuário não encontrado ou senha incorreta)
- `403`: Acesso negado (perfil não permitido - deve ser PROFESSOR ou ADMIN)
- `500`: Erro interno do servidor

---

## Observações Importantes

1. **Perfis Permitidos:**
   - ✅ **PROFESSOR** - Pode fazer login
   - ✅ **ADMIN** - Pode fazer login
   - ❌ **USER** (atleta) - Não pode fazer login nesta rota (deve usar `/api/user/auth/login`)
   - ❌ **ORGANIZER** - Não pode fazer login nesta rota (usa outra rota)

2. **Token JWT:**
   - O token retornado é um JWT (JSON Web Token)
   - Use o token no header `Authorization: Bearer <token>` para requisições autenticadas
   - O token tem tempo de expiração (verificar configuração JWT)

3. **Email:**
   - O email é normalizado (lowercase e trim) antes da busca
   - Certifique-se de usar o email exato cadastrado no sistema

4. **Senha:**
   - A senha é comparada usando bcrypt
   - A senha deve corresponder exatamente à senha cadastrada

5. **Refresh Token:**
   - O `refreshToken` pode ser usado para renovar o token de acesso
   - Implementação de refresh token pode variar conforme a configuração

---

## Fluxo Completo de Teste

1. **Fazer Login:**
   - Faça a requisição POST para `/api/auth/login` com email e senha de um professor
   - Copie o `token` da resposta
   - Configure a variável `token_professor` no Postman com o token copiado

2. **Usar Token em Requisições:**
   - Use o token no header `Authorization: Bearer {{token_professor}}` para requisições autenticadas
   - Exemplo: Buscar perfil do professor (`GET /api/professor/me`)

3. **Testar Endpoints do Professor:**
   - Listar aulas: `GET /api/professor/aula`
   - Criar aula: `POST /api/professor/aula`
   - Listar alunos: `GET /api/professor/alunos`
   - Buscar perfil: `GET /api/professor/me`

---

## Exemplos de Teste

### Teste 1: Login com Credenciais Válidas
```bash
curl -X POST https://carlaobtonline.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "professor@exemplo.com",
    "password": "senha123"
  }'
```

### Teste 2: Login com Email Inválido
```bash
curl -X POST https://carlaobtonline.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "naoexiste@exemplo.com",
    "password": "senha123"
  }'
```
**Resposta esperada:** `401 - Usuário não encontrado`

### Teste 3: Login com Senha Incorreta
```bash
curl -X POST https://carlaobtonline.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "professor@exemplo.com",
    "password": "senhaErrada"
  }'
```
**Resposta esperada:** `401 - Senha incorreta`

### Teste 4: Login com Dados Faltando
```bash
curl -X POST https://carlaobtonline.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "professor@exemplo.com"
  }'
```
**Resposta esperada:** `400 - Informe email e senha.`

---

## Importação no Postman

Para importar esta coleção no Postman:

1. Crie uma nova requisição POST
2. Configure a URL: `{{base_url}}/api/auth/login`
3. Adicione o header: `Content-Type: application/json`
4. No body, selecione "raw" e "JSON", e cole:
```json
{
  "email": "{{email_professor}}",
  "password": "{{senha_professor}}"
}
```
5. Configure as variáveis de ambiente conforme descrito acima
6. Execute a requisição e copie o `token` da resposta para a variável `token_professor`



