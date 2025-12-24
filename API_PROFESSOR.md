# API de Professores - Documentação

## Base URL
```
https://carlaobtonline.vercel.app/api/professor
```

## Autenticação

Todas as rotas exigem autenticação via JWT Bearer Token no header:

```
Authorization: Bearer <seu_token_jwt>
```

## Permissões

- **ADMIN**: Acesso total a todas as rotas
- **PROFESSOR**: Acesso apenas aos seus próprios dados (perfil, aulas, alunos)
- **USER**: Sem acesso às rotas de professor

---

## 1. Perfil do Professor

### GET `/api/professor/me`

Busca o perfil do professor logado.

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Query params:** Nenhum

**Resposta:**
```json
{
  "id": "uuid-do-professor",
  "userId": "uuid-do-usuario",
  "especialidade": "Tênis",
  "bio": "Professor experiente em...",
  "valorHora": 150.00,
  "telefoneProfissional": "(11) 99999-9999",
  "emailProfissional": "professor@email.com",
  "ativo": true,
  "aceitaNovosAlunos": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "usuario": {
    "id": "uuid-do-usuario",
    "name": "Nome do Professor",
    "email": "email@exemplo.com",
    "role": "PROFESSOR"
  }
}
```

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `404`: Perfil de professor não encontrado

---

### GET `/api/professor/[id]`

Busca um professor por ID (aceita `professorId` ou `userId`).

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Path params:** `id` (professorId ou userId)

**Resposta:** (mesmo formato do `/me`)

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: Acesso negado (PROFESSOR só pode ver seu próprio perfil)
- `404`: Professor não encontrado

---

### PUT `/api/professor/[id]`

Atualiza o perfil do professor (aceita `professorId` ou `userId`).

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Path params:** `id` (professorId ou userId)
- **Body:**
```json
{
  "especialidade": "Tênis",
  "bio": "Nova biografia...",
  "valorHora": 200.00,
  "telefoneProfissional": "(11) 88888-8888",
  "emailProfissional": "novoemail@exemplo.com",
  "aceitaNovosAlunos": true
}
```

**Campos opcionais:**
- `especialidade` (string | null)
- `bio` (string | null)
- `valorHora` (number | null)
- `telefoneProfissional` (string | null)
- `emailProfissional` (string | null)
- `aceitaNovosAlunos` (boolean)
- `ativo` (boolean) - **Apenas ADMIN pode alterar**

**Resposta:** Objeto do professor atualizado (mesmo formato do GET)

**Status Codes:**
- `200`: Sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Professor não encontrado

---

### GET `/api/professor`

Lista todos os professores (apenas ADMIN).

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Query params:**
  - `ativo` (boolean, opcional): Filtrar por status ativo
  - `aceitaNovosAlunos` (boolean, opcional): Filtrar por aceita novos alunos

**Exemplo:**
```
GET /api/professor?ativo=true&aceitaNovosAlunos=true
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "especialidade": "...",
    ...
  }
]
```

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: Acesso negado (apenas ADMIN)

---

### POST `/api/professor`

Cria um novo perfil de professor.

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "especialidade": "Tênis",
  "bio": "Descrição...",
  "valorHora": 150.00,
  "telefoneProfissional": "(11) 99999-9999",
  "emailProfissional": "professor@email.com",
  "ativo": true,
  "aceitaNovosAlunos": true,
  "userId": "uuid" // Obrigatório apenas se ADMIN estiver criando para outro usuário
}
```

**Campos obrigatórios:**
- Nenhum (exceto `userId` se for ADMIN)

**Campos opcionais:**
- Todos os campos acima

**Resposta:** Objeto do professor criado

**Status Codes:**
- `201`: Criado com sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `403`: Acesso negado
- `409`: Usuário já possui perfil de professor

---

## 2. Alunos do Professor

### GET `/api/professor/alunos`

Lista os alunos do professor logado.

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Query params:**
  - `apenasAtivos` (boolean, opcional): Default `true`. Se `false`, retorna todos os alunos.

**Exemplo:**
```
GET /api/professor/alunos?apenasAtivos=false
```

**Resposta:**
```json
[
  {
    "id": "uuid-da-relacao",
    "professorId": "uuid-do-professor",
    "atletaId": "uuid-do-atleta",
    "nivel": "INTERMEDIARIO",
    "observacoes": "Aluno dedicado...",
    "ativo": true,
    "iniciadoEm": "2024-01-01T00:00:00.000Z",
    "encerradoEm": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "atleta": {
      "id": "uuid",
      "nome": "Nome do Aluno",
      "fone": "(11) 99999-9999",
      "fotoUrl": "https://..."
    }
  }
]
```

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `404`: Perfil de professor não encontrado

---

### POST `/api/professor/alunos`

Cria uma relação professor-aluno (longo prazo).

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "atletaId": "uuid-do-atleta",
  "nivel": "INICIANTE", // opcional: "INICIANTE" | "INTERMEDIARIO" | "AVANCADO" | null
  "observacoes": "Observações sobre o aluno" // opcional
}
```

**Campos obrigatórios:**
- `atletaId` (string)

**Resposta:** Objeto da relação criada

**Status Codes:**
- `201`: Criado com sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `404`: Perfil de professor não encontrado
- `409`: Relação professor-aluno já existe

---

## 3. Aulas

### GET `/api/professor/aula`

Lista as aulas do professor logado.

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Query params:**
  - `status` (string, opcional): Filtrar por status ("AGENDADA", "CONFIRMADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA", "ADIADA")
  - `dataInicio` (string ISO, opcional): Filtrar aulas a partir desta data
  - `dataFim` (string ISO, opcional): Filtrar aulas até esta data

**Exemplo:**
```
GET /api/professor/aula?status=CONFIRMADA&dataInicio=2024-01-01T00:00:00Z
```

**Resposta:**
```json
[
  {
    "id": "uuid-da-aula",
    "professorId": "uuid-do-professor",
    "agendamentoId": "uuid-do-agendamento",
    "titulo": "Aula de Tênis",
    "descricao": "Aula prática...",
    "tipoAula": "INDIVIDUAL", // "INDIVIDUAL" | "GRUPO" | "TURMA"
    "nivel": "INTERMEDIARIO", // "INICIANTE" | "INTERMEDIARIO" | "AVANCADO" | null
    "maxAlunos": 1,
    "valorPorAluno": 150.00,
    "valorTotal": 150.00,
    "status": "CONFIRMADA",
    "dataInicio": "2024-01-15T10:00:00.000Z",
    "dataFim": "2024-01-15T11:00:00.000Z",
    "recorrenciaId": null,
    "recorrenciaConfig": null,
    "observacoes": "Trazer raquete",
    "materialNecessario": "Raquete e bolas",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "professor": {
      "id": "uuid",
      "userId": "uuid",
      "especialidade": "Tênis",
      "usuario": {
        "id": "uuid",
        "name": "Nome do Professor",
        "email": "professor@email.com"
      }
    },
    "agendamento": {
      "id": "uuid",
      "quadraId": "uuid",
      "dataHora": "2024-01-15T10:00:00.000Z",
      "duracao": 60,
      "status": "CONFIRMADO",
      "quadra": {
        "id": "uuid",
        "nome": "Quadra 1",
        "tipo": "Tênis",
        "point": {
          "id": "uuid",
          "nome": "Arena"
        }
      }
    }
  }
]
```

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `404`: Perfil de professor não encontrado

---

### POST `/api/professor/aula`

Cria uma nova aula vinculada a um agendamento.

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "agendamentoId": "uuid-do-agendamento",
  "titulo": "Aula de Tênis",
  "descricao": "Aula prática de forehand", // opcional
  "tipoAula": "INDIVIDUAL", // obrigatório: "INDIVIDUAL" | "GRUPO" | "TURMA"
  "nivel": "INTERMEDIARIO", // opcional: "INICIANTE" | "INTERMEDIARIO" | "AVANCADO" | null
  "maxAlunos": 1, // opcional, default: 1
  "valorPorAluno": 150.00, // opcional
  "valorTotal": 150.00, // opcional
  "status": "AGENDADA", // opcional, default: "AGENDADA"
  "dataInicio": "2024-01-15T10:00:00.000Z", // obrigatório (ISO string)
  "dataFim": "2024-01-15T11:00:00.000Z", // opcional (ISO string)
  "recorrenciaId": null, // opcional
  "recorrenciaConfig": null, // opcional
  "observacoes": "Trazer raquete", // opcional
  "materialNecessario": "Raquete e bolas" // opcional
}
```

**Campos obrigatórios:**
- `agendamentoId` (string)
- `titulo` (string)
- `tipoAula` (string): "INDIVIDUAL" | "GRUPO" | "TURMA"
- `dataInicio` (string ISO)

**Resposta:** Objeto da aula criada

**Status Codes:**
- `201`: Criado com sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `404`: Perfil de professor não encontrado
- `409`: Este agendamento já possui uma aula vinculada

---

### GET `/api/professor/aula/[id]`

Busca uma aula específica por ID.

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Path params:** `id` (aulaId)

**Resposta:** Objeto da aula (mesmo formato do GET `/api/professor/aula`)

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: Acesso negado (PROFESSOR só pode ver suas próprias aulas)
- `404`: Aula não encontrada

---

### PUT `/api/professor/aula/[id]`

Atualiza uma aula.

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Path params:** `id` (aulaId)
- **Body:**
```json
{
  "titulo": "Novo título",
  "descricao": "Nova descrição",
  "tipoAula": "GRUPO",
  "nivel": "AVANCADO",
  "maxAlunos": 4,
  "valorPorAluno": 200.00,
  "valorTotal": 800.00,
  "status": "CONFIRMADA",
  "dataInicio": "2024-01-20T10:00:00.000Z",
  "dataFim": "2024-01-20T11:00:00.000Z",
  "observacoes": "Nova observação",
  "materialNecessario": "Novo material"
}
```

**Campos opcionais:**
- Todos os campos acima (envie apenas os que deseja atualizar)

**Resposta:** Objeto da aula atualizada

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Aula não encontrada

---

## 4. Alunos de uma Aula

### GET `/api/professor/aula/[id]/alunos`

Lista os alunos inscritos em uma aula específica.

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Path params:** `id` (aulaId)

**Resposta:**
```json
[
  {
    "id": "uuid-da-inscricao",
    "aulaId": "uuid-da-aula",
    "atletaId": "uuid-do-atleta",
    "statusInscricao": "CONFIRMADO", // "CONFIRMADO" | "AGUARDANDO" | "CANCELADO" | "FALTOU"
    "presenca": true,
    "valorPago": 150.00,
    "valorDevido": 0.00,
    "observacao": null,
    "notaAluno": null,
    "inscritoEm": "2024-01-10T00:00:00.000Z",
    "canceladoEm": null,
    "createdAt": "2024-01-10T00:00:00.000Z",
    "updatedAt": "2024-01-10T00:00:00.000Z",
    "atleta": {
      "id": "uuid",
      "nome": "Nome do Aluno",
      "fone": "(11) 99999-9999",
      "fotoUrl": "https://..."
    }
  }
]
```

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Aula não encontrada

---

### POST `/api/professor/aula/[id]/alunos`

Inscreve um aluno em uma aula.

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Path params:** `id` (aulaId)
- **Body:**
```json
{
  "atletaId": "uuid-do-atleta",
  "statusInscricao": "CONFIRMADO", // opcional, default: "CONFIRMADO"
  "valorPago": 150.00, // opcional
  "valorDevido": 0.00 // opcional
}
```

**Campos obrigatórios:**
- `atletaId` (string)

**Resposta:** Objeto da inscrição criada

**Status Codes:**
- `201`: Criado com sucesso
- `400`: Dados inválidos (aula lotada ou aluno já inscrito)
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Aula não encontrada

---

## 5. Presença dos Alunos

### POST `/api/professor/aula/[id]/presenca`

Marca presença de múltiplos alunos em uma aula.

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Path params:** `id` (aulaId)
- **Body:**
```json
{
  "presencas": [
    {
      "inscricaoId": "uuid-da-inscricao-1",
      "presente": true
    },
    {
      "inscricaoId": "uuid-da-inscricao-2",
      "presente": false
    }
  ]
}
```

**Campos obrigatórios:**
- `presencas` (array): Array de objetos com `inscricaoId` (string) e `presente` (boolean)

**Resposta:**
```json
{
  "mensagem": "Presenças marcadas com sucesso",
  "alunos": [
    // Array com todos os alunos da aula (mesmo formato do GET /alunos)
  ]
}
```

**Status Codes:**
- `200`: Sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Aula não encontrada

---

## 6. Avaliações de Alunos

### GET `/api/professor/aula/[id]/avaliacao`

Lista as avaliações de alunos de uma aula.

**Requisição:**
- **Headers:** `Authorization: Bearer <token>`
- **Path params:** `id` (aulaId)

**Resposta:**
```json
[
  {
    "id": "uuid-da-avaliacao",
    "aulaId": "uuid-da-aula",
    "professorId": "uuid-do-professor",
    "atletaId": "uuid-do-atleta",
    "nota": 8.5,
    "comentario": "Excelente desempenho",
    "pontosPositivos": "Boa técnica, dedicação",
    "pontosMelhorar": "Precisa trabalhar mais o backhand",
    "tecnica": 9,
    "fisico": 8,
    "comportamento": 10,
    "avaliadoEm": "2024-01-16T00:00:00.000Z",
    "createdAt": "2024-01-16T00:00:00.000Z",
    "updatedAt": "2024-01-16T00:00:00.000Z",
    "atleta": {
      "id": "uuid",
      "nome": "Nome do Aluno"
    },
    "aula": {
      "id": "uuid",
      "titulo": "Aula de Tênis"
    }
  }
]
```

**Status Codes:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Aula não encontrada

---

### POST `/api/professor/aula/[id]/avaliacao`

Cria uma avaliação para um aluno de uma aula.

**Requisição:**
- **Headers:** 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Path params:** `id` (aulaId)
- **Body:**
```json
{
  "atletaId": "uuid-do-atleta",
  "nota": 8.5, // opcional
  "comentario": "Excelente desempenho", // opcional
  "pontosPositivos": "Boa técnica, dedicação", // opcional
  "pontosMelhorar": "Precisa trabalhar mais o backhand", // opcional
  "tecnica": 9, // opcional (0-10)
  "fisico": 8, // opcional (0-10)
  "comportamento": 10 // opcional (0-10)
}
```

**Campos obrigatórios:**
- `atletaId` (string)

**Campos opcionais:**
- `nota` (number)
- `comentario` (string)
- `pontosPositivos` (string)
- `pontosMelhorar` (string)
- `tecnica` (number): 0-10
- `fisico` (number): 0-10
- `comportamento` (number): 0-10

**Resposta:** Objeto da avaliação criada

**Status Codes:**
- `201`: Criado com sucesso
- `400`: Dados inválidos
- `401`: Não autenticado
- `403`: Acesso negado
- `404`: Aula não encontrada
- `409`: Avaliação já existe para este aluno nesta aula

---

## Enums e Valores Permitidos

### Status da Aula
- `AGENDADA`
- `CONFIRMADA`
- `EM_ANDAMENTO`
- `CONCLUIDA`
- `CANCELADA`
- `ADIADA`

### Tipo de Aula
- `INDIVIDUAL`
- `GRUPO`
- `TURMA`

### Nível
- `INICIANTE`
- `INTERMEDIARIO`
- `AVANCADO`

### Status de Inscrição
- `CONFIRMADO`
- `AGUARDANDO`
- `CANCELADO`
- `FALTOU`

---

## Códigos de Erro Comuns

- `400`: Bad Request - Dados inválidos ou faltando campos obrigatórios
- `401`: Unauthorized - Token inválido ou ausente
- `403`: Forbidden - Usuário não tem permissão para acessar o recurso
- `404`: Not Found - Recurso não encontrado
- `409`: Conflict - Recurso já existe (ex: professor já possui perfil)
- `500`: Internal Server Error - Erro interno do servidor

---

## Exemplos de Uso

### Exemplo 1: Buscar perfil do professor
```javascript
const response = await fetch('https://carlaobtonline.vercel.app/api/professor/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const professor = await response.json();
```

### Exemplo 2: Atualizar perfil
```javascript
const response = await fetch(`https://carlaobtonline.vercel.app/api/professor/${professorId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    especialidade: 'Tênis',
    valorHora: 200.00,
    aceitaNovosAlunos: true
  })
});
```

### Exemplo 3: Criar aula
```javascript
const response = await fetch('https://carlaobtonline.vercel.app/api/professor/aula', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agendamentoId: 'uuid-do-agendamento',
    titulo: 'Aula de Tênis',
    tipoAula: 'INDIVIDUAL',
    dataInicio: '2024-01-15T10:00:00.000Z'
  })
});
```

### Exemplo 4: Marcar presença
```javascript
const response = await fetch(`https://carlaobtonline.vercel.app/api/professor/aula/${aulaId}/presenca`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    presencas: [
      { inscricaoId: 'uuid-1', presente: true },
      { inscricaoId: 'uuid-2', presente: false }
    ]
  })
});
```

