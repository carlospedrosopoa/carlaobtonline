# 📚 Documentação da API - Frontend Externo

Documentação completa da API para consumo por frontends externos.

## 🔗 Base URL

- **Desenvolvimento**: `http://localhost:3000/api`
- **Produção**: `https://seu-projeto.vercel.app/api` (substitua pelo seu domínio)

## 🔐 Autenticação

A API utiliza **JWT (JSON Web Token)** para autenticação. Todas as requisições autenticadas devem incluir o token no header `Authorization`.

### Formato do Header

```
Authorization: Bearer <seu-token-jwt>
```

### Como Obter o Token

Faça login através da rota `/api/auth/login` (veja seção de Autenticação abaixo).

---

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Usuários](#usuários)
3. [Atletas](#atletas)
4. [Partidas](#partidas)

---

## 🔑 Autenticação

### POST `/api/auth/login`

Realiza login e retorna o token JWT.

**Autenticação**: Não requerida

**Request Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "usuario": {
    "id": "uuid-do-usuario",
    "nome": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "role": "USER",
    "atletaId": null,
    "pointIdGestor": null
  },
  "user": {
    // Alias para usuario (mesmos dados)
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erros:**
- `400`: Email ou senha não fornecidos
- `401`: Usuário não encontrado ou senha incorreta
- `500`: Erro interno do servidor

**Exemplo (JavaScript):**
```javascript
const response = await fetch('https://api.exemplo.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'senha123'
  })
});

const data = await response.json();
// Salvar o token
localStorage.setItem('token', data.token);
```

---

### GET `/api/auth/me`

Retorna os dados do usuário autenticado.

**Autenticação**: Requerida (Bearer Token)

**Response 200:**
```json
{
  "id": "uuid-do-usuario",
  "nome": "Nome do Usuário",
  "email": "usuario@exemplo.com",
  "role": "USER",
  "atletaId": null,
  "pointIdGestor": null
}
```

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

**Exemplo:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('https://api.exemplo.com/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const usuario = await response.json();
```

---

### POST `/api/auth/register`

Cria um novo usuário. **Apenas ADMIN pode criar usuários.**

**Autenticação**: Requerida (Bearer Token - ADMIN apenas)

**Request Body:**
```json
{
  "name": "Nome do Usuário",
  "email": "usuario@exemplo.com",
  "password": "senha123",
  "role": "USER" // Opcional: "ADMIN", "ORGANIZER" ou "USER" (padrão)
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid-do-usuario",
    "name": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "role": "USER"
  }
}
```

**Erros:**
- `400`: Dados inválidos ou email já cadastrado
- `401`: Não autenticado
- `403`: Acesso negado (não é ADMIN)
- `500`: Erro interno do servidor

---

## 👤 Usuários

### GET `/api/user/getUsuarioLogado`

Retorna os dados completos do usuário logado (incluindo campos adicionais do banco).

**Autenticação**: Requerida (Bearer Token)

**Response 200:**
```json
{
  "id": "uuid-do-usuario",
  "name": "Nome do Usuário",
  "email": "usuario@exemplo.com",
  "role": "USER",
  "pointIdGestor": null
}
```

**Erros:**
- `401`: Não autenticado
- `404`: Usuário não encontrado
- `500`: Erro interno do servidor

---

### GET `/api/user/list`

Lista todos os usuários. **Apenas ADMIN pode listar usuários.**

**Autenticação**: Requerida (Bearer Token - ADMIN apenas)

**Response 200:**
```json
[
  {
    "id": "uuid-1",
    "name": "Usuário 1",
    "email": "user1@exemplo.com",
    "role": "USER",
    "pointIdGestor": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "uuid-2",
    "name": "Usuário 2",
    "email": "user2@exemplo.com",
    "role": "ADMIN",
    "pointIdGestor": null,
    "createdAt": "2024-01-02T00:00:00.000Z"
  }
]
```

**Erros:**
- `401`: Não autenticado
- `403`: Acesso negado (não é ADMIN)
- `500`: Erro interno do servidor

---

### PUT `/api/user/[id]`

Atualiza um usuário. **Apenas ADMIN pode atualizar usuários.**

**Autenticação**: Requerida (Bearer Token - ADMIN apenas)

**Parâmetros de URL:**
- `id`: UUID do usuário

**Request Body (todos os campos são opcionais):**
```json
{
  "name": "Novo Nome",
  "email": "novo@exemplo.com",
  "password": "novaSenha123",
  "role": "ORGANIZER",
  "pointIdGestor": "uuid-do-point"
}
```

**Response 200:**
```json
{
  "id": "uuid-do-usuario",
  "name": "Novo Nome",
  "email": "novo@exemplo.com",
  "role": "ORGANIZER",
  "pointIdGestor": "uuid-do-point",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Erros:**
- `400`: Dados inválidos ou email já em uso
- `401`: Não autenticado
- `403`: Acesso negado (não é ADMIN)
- `404`: Usuário não encontrado
- `500`: Erro interno do servidor

---

### PUT `/api/user/perfil`

Atualiza o perfil do usuário logado (nome e/ou senha).

**Autenticação**: Requerida (Bearer Token)

**Request Body (todos os campos são opcionais):**
```json
{
  "name": "Novo Nome",
  "password": "novaSenha123"
}
```

**Response 200:**
```json
{
  "mensagem": "Perfil atualizado com sucesso"
}
```

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

## 🏃 Atletas

### GET `/api/atleta/listarAtletas`

Lista todos os atletas. Retorna apenas os atletas que o usuário tem permissão para ver.

**Autenticação**: Requerida (Bearer Token)

**Response 200:**
```json
{
  "atletas": [
    {
      "id": "uuid-do-atleta",
      "nome": "Nome do Atleta",
      "dataNascimento": "2000-01-01T00:00:00.000Z",
      "categoria": "Adulto",
      "genero": "M",
      "fone": "11999999999",
      "fotoUrl": "data:image/jpeg;base64,...",
      "usuarioId": "uuid-do-usuario",
      "pointIdPrincipal": "uuid-do-point",
      "idade": 24,
      "usuario": {
        "name": "Nome do Usuário",
        "role": "USER"
      },
      "arenasFrequentes": [
        {
          "id": "uuid-do-point",
          "nome": "Arena Exemplo",
          "logoUrl": "https://..."
        }
      ],
      "arenaPrincipal": {
        "id": "uuid-do-point",
        "nome": "Arena Exemplo",
        "logoUrl": "https://..."
      }
    }
  ],
  "usuario": {
    "id": "uuid-do-usuario",
    "role": "USER"
  }
}
```

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

### GET `/api/atleta/me/atleta`

Retorna o atleta associado ao usuário logado.

**Autenticação**: Requerida (Bearer Token)

**Response 200:**
```json
{
  "id": "uuid-do-atleta",
  "nome": "Nome do Atleta",
  "dataNascimento": "2000-01-01T00:00:00.000Z",
  "categoria": "Adulto",
  "genero": "M",
  "fone": "11999999999",
  "fotoUrl": "data:image/jpeg;base64,...",
  "usuarioId": "uuid-do-usuario",
  "pointIdPrincipal": "uuid-do-point",
  "idade": 24,
  "usuario": {
    "name": "Nome do Usuário",
    "role": "USER"
  },
  "arenasFrequentes": [...],
  "arenaPrincipal": {...}
}
```

**Response 204:** (No Content) - Usuário não possui atleta cadastrado

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

### GET `/api/atleta/listarAtletasPaginados`

Lista atletas com paginação e busca.

**Autenticação**: Requerida (Bearer Token)

**Query Parameters:**
- `busca` (opcional): Termo de busca (busca no nome)
- `pagina` (opcional, padrão: 1): Número da página
- `limite` (opcional, padrão: 10): Itens por página

**Exemplo:**
```
GET /api/atleta/listarAtletasPaginados?busca=João&pagina=1&limite=10
```

**Response 200:**
```json
[
  {
    "id": "uuid-do-atleta",
    "nome": "João Silva",
    "dataNascimento": "2000-01-01T00:00:00.000Z",
    "idade": 24
  }
]
```

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

### GET `/api/atleta/para-selecao`

Lista simplificada de atletas para seleção em dropdowns/selects (ideal para criação de partidas).

**Autenticação**: Requerida (Bearer Token)

**Query Parameters:**
- `busca` (opcional): Termo de busca (busca no nome)

**Permissões:**
- **Todos os usuários autenticados**: Retorna todos os atletas cadastrados
- Permite que frontends externos (que logam como USER) possam selecionar qualquer atleta para criar partidas

**Exemplo:**
```
GET /api/atleta/para-selecao?busca=João
```

**Response 200:**
```json
[
  {
    "id": "uuid-do-atleta-1",
    "nome": "João Silva",
    "idade": 24,
    "categoria": "Adulto",
    "genero": "M"
  },
  {
    "id": "uuid-do-atleta-2",
    "nome": "Maria Santos",
    "idade": 22,
    "categoria": "Adulto",
    "genero": "F"
  }
]
```

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

**Uso recomendado:**
Esta rota é ideal para popular dropdowns/selects ao criar partidas, pois retorna apenas os dados essenciais (id, nome, idade, categoria, genero) sem informações extras como arenas, foto completa, etc.

**Exemplo de uso:**
```javascript
// Carregar atletas para seleção em um formulário de partida
const atletas = await api.get('/atleta/para-selecao?busca=João');
// Retorna lista simplificada para popular <select> ou componente de seleção
```

---

### POST `/api/atleta/criarAtleta`

Cria um novo atleta associado ao usuário logado.

**Autenticação**: Requerida (Bearer Token)

**Request Body:**
```json
{
  "nome": "Nome do Atleta",
  "dataNascimento": "2000-01-01",
  "categoria": "Adulto", // Opcional
  "genero": "M", // Opcional: "M" ou "F"
  "fone": "11999999999", // Opcional
  "fotoUrl": "data:image/jpeg;base64,...", // Opcional (base64)
  "pointIdPrincipal": "uuid-do-point", // Opcional
  "pointIdsFrequentes": ["uuid-1", "uuid-2"] // Opcional: array de UUIDs
}
```

**Campos Obrigatórios:**
- `nome`
- `dataNascimento` (formato: YYYY-MM-DD)

**Response 201:**
```json
{
  "id": "uuid-do-atleta",
  "nome": "Nome do Atleta",
  "dataNascimento": "2000-01-01T00:00:00.000Z",
  "categoria": "Adulto",
  "genero": "M",
  "fone": "11999999999",
  "fotoUrl": "data:image/jpeg;base64,...",
  "usuarioId": "uuid-do-usuario",
  "pointIdPrincipal": "uuid-do-point",
  "idade": 24,
  "usuario": {...},
  "arenasFrequentes": [...],
  "arenaPrincipal": {...}
}
```

**Erros:**
- `400`: Dados inválidos (nome ou dataNascimento faltando)
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

### GET `/api/atleta/[id]`

Retorna um atleta específico por ID.

**Autenticação**: Requerida (Bearer Token)

**Parâmetros de URL:**
- `id`: UUID do atleta

**Response 200:**
```json
{
  "id": "uuid-do-atleta",
  "nome": "Nome do Atleta",
  "dataNascimento": "2000-01-01T00:00:00.000Z",
  "categoria": "Adulto",
  "genero": "M",
  "fone": "11999999999",
  "fotoUrl": "data:image/jpeg;base64,...",
  "usuarioId": "uuid-do-usuario",
  "pointIdPrincipal": "uuid-do-point",
  "idade": 24,
  "usuario": {...},
  "arenasFrequentes": [...],
  "arenaPrincipal": {...}
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Sem permissão para visualizar este atleta
- `404`: Atleta não encontrado
- `500`: Erro interno do servidor

---

### PUT `/api/atleta/[id]`

Atualiza um atleta. Apenas o dono do atleta ou ADMIN pode atualizar.

**Autenticação**: Requerida (Bearer Token)

**Parâmetros de URL:**
- `id`: UUID do atleta

**Request Body (todos os campos são opcionais):**
```json
{
  "nome": "Novo Nome",
  "dataNascimento": "2000-01-01",
  "categoria": "Juvenil",
  "genero": "F",
  "fone": "11888888888",
  "fotoUrl": "data:image/jpeg;base64,...",
  "pointIdPrincipal": "uuid-do-point",
  "pointIdsFrequentes": ["uuid-1", "uuid-2"]
}
```

**Response 200:**
```json
{
  "id": "uuid-do-atleta",
  "nome": "Novo Nome",
  "dataNascimento": "2000-01-01T00:00:00.000Z",
  "categoria": "Juvenil",
  "genero": "F",
  "fone": "11888888888",
  "fotoUrl": "data:image/jpeg;base64,...",
  "usuarioId": "uuid-do-usuario",
  "pointIdPrincipal": "uuid-do-point",
  "idade": 24,
  "usuario": {...},
  "arenasFrequentes": [...],
  "arenaPrincipal": {...}
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Sem permissão para atualizar este atleta
- `404`: Atleta não encontrado
- `500`: Erro interno do servidor

---

## 🎾 Partidas

### GET `/api/partida/listarPartidas`

Lista todas as partidas.

**Autenticação**: Requerida (Bearer Token)

**Response 200:**
```json
[
  {
    "id": "uuid-da-partida",
    "data": "2024-01-15T10:00:00.000Z",
    "local": "Arena Exemplo",
    "atleta1Id": "uuid-do-atleta-1",
    "atleta2Id": "uuid-do-atleta-2",
    "atleta3Id": null,
    "atleta4Id": null,
    "gamesTime1": 6,
    "gamesTime2": 4,
    "tiebreakTime1": null,
    "tiebreakTime2": null,
    "atleta1": {
      "id": "uuid-do-atleta-1",
      "nome": "Atleta 1"
    },
    "atleta2": {
      "id": "uuid-do-atleta-2",
      "nome": "Atleta 2"
    },
    "atleta3": null,
    "atleta4": null
  }
]
```

**Erros:**
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

### POST `/api/partida/criarPartida`

Cria uma nova partida.

**Autenticação**: Requerida (Bearer Token)

**Request Body:**
```json
{
  "data": "2024-01-15T10:00:00.000Z",
  "local": "Arena Exemplo",
  "atleta1Id": "uuid-do-atleta-1",
  "atleta2Id": "uuid-do-atleta-2",
  "atleta3Id": null, // Opcional
  "atleta4Id": null, // Opcional
  "gamesTime1": 6, // Opcional
  "gamesTime2": 4, // Opcional
  "tiebreakTime1": null, // Opcional
  "tiebreakTime2": null // Opcional
}
```

**Campos Obrigatórios:**
- `data` (formato ISO 8601)
- `local`
- `atleta1Id`
- `atleta2Id`

**Response 201:**
```json
{
  "id": "uuid-da-partida",
  "data": "2024-01-15T10:00:00.000Z",
  "local": "Arena Exemplo",
  "atleta1Id": "uuid-do-atleta-1",
  "atleta2Id": "uuid-do-atleta-2",
  "atleta3Id": null,
  "atleta4Id": null,
  "gamesTime1": 6,
  "gamesTime2": 4,
  "tiebreakTime1": null,
  "tiebreakTime2": null
}
```

**Erros:**
- `400`: Dados inválidos (atleta1Id ou atleta2Id faltando)
- `401`: Não autenticado
- `500`: Erro interno do servidor

---

## 📝 Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 204 | Sucesso sem conteúdo (No Content) |
| 400 | Requisição inválida (dados faltando ou inválidos) |
| 401 | Não autenticado (token inválido ou ausente) |
| 403 | Acesso negado (sem permissão) |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

## 🔒 Permissões por Role

### USER
- Pode criar e gerenciar seu próprio atleta
- Pode criar e visualizar suas próprias partidas
- Pode visualizar seu próprio perfil

### ORGANIZER
- Todas as permissões de USER
- Pode visualizar todos os atletas
- Pode gerenciar agendamentos da sua arena

### ADMIN
- Todas as permissões
- Pode criar usuários
- Pode atualizar qualquer usuário
- Pode visualizar todos os atletas e partidas

---

## 🛠️ Exemplo de Cliente API (JavaScript)

```javascript
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.token = null;
  }

  // Salvar token após login
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  // Carregar token do localStorage
  loadToken() {
    this.token = localStorage.getItem('token');
  }

  // Fazer requisição autenticada
  async request(endpoint, options = {}) {
    this.loadToken();
    
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensagem || error.error || 'Erro na requisição');
    }

    // Se for 204 No Content, retornar null
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  // Métodos HTTP
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Métodos específicos da API
  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.get('/auth/me');
  }

  async getUsuarioLogado() {
    return this.get('/user/getUsuarioLogado');
  }

  async criarAtleta(dados) {
    return this.post('/atleta/criarAtleta', dados);
  }

  async listarAtletas() {
    const data = await this.get('/atleta/listarAtletas');
    return data.atletas;
  }

  async listarAtletasParaSelecao(busca = '') {
    const endpoint = busca 
      ? `/atleta/para-selecao?busca=${encodeURIComponent(busca)}`
      : '/atleta/para-selecao';
    return this.get(endpoint);
  }

  async getMeuAtleta() {
    return this.get('/atleta/me/atleta');
  }

  async criarPartida(dados) {
    return this.post('/partida/criarPartida', dados);
  }

  async listarPartidas() {
    return this.get('/partida/listarPartidas');
  }

  async uploadImage(file, folder = 'uploads') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const url = `${this.baseURL}/upload/image`;
    const headers: Record<string, string> = {};
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.mensagem || 'Erro no upload');
    }

    return await response.json();
  }
}

// Uso
const api = new ApiClient('https://api.exemplo.com/api');

// Login
try {
  const { usuario, token } = await api.login('usuario@exemplo.com', 'senha123');
  console.log('Logado como:', usuario.nome);
} catch (error) {
  console.error('Erro no login:', error.message);
}

// Buscar meu atleta
try {
  const atleta = await api.getMeuAtleta();
  console.log('Meu atleta:', atleta);
} catch (error) {
  console.error('Erro ao buscar atleta:', error.message);
}
```

---

## ⚠️ Tratamento de Erros

Sempre trate erros nas requisições:

```javascript
try {
  const data = await api.get('/atleta/listarAtletas');
  // Processar dados
} catch (error) {
  if (error.message.includes('401') || error.message.includes('Não autenticado')) {
    // Token expirado ou inválido - fazer login novamente
    window.location.href = '/login';
  } else {
    // Outro erro - mostrar mensagem ao usuário
    alert('Erro: ' + error.message);
  }
}
```

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação de CORS: `VERCEL_CORS_SETUP.md`
- README do projeto: `README.md`

---

## 📸 Upload de Imagens

### POST `/api/upload/image`

Faz upload de uma imagem para o Google Cloud Storage e retorna a URL pública.

**Autenticação**: Requerida (Bearer Token)

**Request Body (FormData):**
- `file` (File): Arquivo de imagem (obrigatório)
- `folder` (string, opcional): Pasta onde salvar (padrão: 'uploads')
  - Exemplos: `atletas`, `points`, `uploads`

**Validações:**
- Tipos permitidos: JPG, JPEG, PNG, GIF, WEBP
- Tamanho máximo: 5MB

**Response 200:**
```json
{
  "url": "https://storage.googleapis.com/seu-bucket/atletas/uuid.jpg",
  "fileName": "atletas/uuid.jpg",
  "size": 123456,
  "mensagem": "Upload realizado com sucesso"
}
```

**Erros:**
- `400`: Arquivo não fornecido ou inválido
- `401`: Não autenticado
- `500`: Erro ao fazer upload

**Exemplo de uso:**
```javascript
// Criar FormData
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', 'atletas');

// Fazer upload
const response = await fetch('https://api.exemplo.com/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const { url } = await response.json();
// Usar a URL ao criar/atualizar atleta
await api.post('/atleta/criarAtleta', {
  nome: 'João',
  dataNascimento: '2000-01-01',
  fotoUrl: url // URL do Google Cloud Storage
});
```

**Fluxo recomendado:**
1. Usuário seleciona imagem no frontend
2. Frontend valida tipo e tamanho
3. Frontend faz upload via `/api/upload/image`
4. API retorna URL do GCS
5. Frontend usa URL ao criar/atualizar atleta

---

**Última atualização**: 2024

