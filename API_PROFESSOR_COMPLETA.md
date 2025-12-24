# API do Módulo de Professores - Documentação Completa

Este documento descreve todas as rotas API implementadas para o módulo de professores.

## 📋 Índice

1. [Rotas de Professor](#rotas-de-professor)
2. [Rotas de Aula](#rotas-de-aula)
3. [Rotas de Alunos](#rotas-de-alunos)
4. [Rotas de Avaliação](#rotas-de-avaliação)
5. [Autenticação e Permissões](#autenticação-e-permissões)

---

## 🔐 Autenticação e Permissões

Todas as rotas requerem autenticação via JWT Bearer Token no header:
```
Authorization: Bearer <token>
```

### Roles e Permissões:
- **ADMIN**: Acesso total a todas as rotas
- **PROFESSOR**: Pode gerenciar apenas seus próprios dados (perfil, aulas, alunos, avaliações)

---

## 👨‍🏫 Rotas de Professor

### GET /api/professor
Lista todos os professores (apenas ADMIN).

**Query Params (opcionais):**
- `ativo` (boolean): Filtrar por status ativo
- `aceitaNovosAlunos` (boolean): Filtrar por aceita novos alunos

**Resposta:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "especialidade": "Beach Tennis",
    "bio": "Professor experiente...",
    "valorHora": 150.00,
    "telefoneProfissional": "(11) 99999-9999",
    "emailProfissional": "prof@email.com",
    "ativo": true,
    "aceitaNovosAlunos": true,
    "createdAt": "2024-12-01T10:00:00Z",
    "updatedAt": "2024-12-01T10:00:00Z",
    "usuario": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com",
      "role": "PROFESSOR"
    }
  }
]
```

### POST /api/professor
Cria perfil de professor para um usuário.

**Body:**
```json
{
  "especialidade": "Beach Tennis",
  "bio": "Professor experiente com 10 anos de prática",
  "valorHora": 150.00,
  "telefoneProfissional": "(11) 99999-9999",
  "emailProfissional": "prof@email.com",
  "ativo": true,
  "aceitaNovosAlunos": true,
  "userId": "uuid" // Opcional - apenas ADMIN pode passar
}
```

**Notas:**
- PROFESSOR: cria perfil para si mesmo (userId do token)
- ADMIN: pode criar para qualquer usuário (deve passar userId)

**Resposta:** 201 Created com objeto do professor criado

### GET /api/professor/me
Busca perfil do professor logado.

**Resposta:** 200 OK com objeto do professor

### GET /api/professor/[id]
Busca professor por ID.

**Resposta:** 200 OK com objeto do professor

### PUT /api/professor/[id]
Atualiza dados do professor.

**Body (todos os campos opcionais):**
```json
{
  "especialidade": "Tênis",
  "bio": "Nova bio",
  "valorHora": 200.00,
  "telefoneProfissional": "(11) 88888-8888",
  "emailProfissional": "novo@email.com",
  "ativo": true, // Apenas ADMIN pode alterar
  "aceitaNovosAlunos": false
}
```

**Resposta:** 200 OK com objeto do professor atualizado

---

## 📚 Rotas de Aula

### GET /api/professor/aula
Lista aulas do professor logado.

**Query Params (opcionais):**
- `status`: Filtrar por status (AGENDADA, CONFIRMADA, EM_ANDAMENTO, CONCLUIDA, CANCELADA, ADIADA)
- `dataInicio`: Filtrar aulas a partir desta data (ISO string)
- `dataFim`: Filtrar aulas até esta data (ISO string)

**Resposta:**
```json
[
  {
    "id": "uuid",
    "professorId": "uuid",
    "agendamentoId": "uuid",
    "titulo": "Aula de Beach Tennis - Iniciantes",
    "descricao": "Aula para iniciantes...",
    "tipoAula": "GRUPO",
    "nivel": "INICIANTE",
    "maxAlunos": 4,
    "valorPorAluno": 50.00,
    "status": "AGENDADA",
    "dataInicio": "2024-12-01T10:00:00Z",
    "professor": { ... },
    "agendamento": {
      "id": "uuid",
      "quadraId": "uuid",
      "dataHora": "2024-12-01T10:00:00Z",
      "quadra": {
        "id": "uuid",
        "nome": "Quadra 1",
        "point": {
          "id": "uuid",
          "nome": "Arena Central"
        }
      }
    }
  }
]
```

### POST /api/professor/aula
Cria nova aula vinculada a um agendamento.

**Body:**
```json
{
  "agendamentoId": "uuid", // obrigatório
  "titulo": "Aula de Beach Tennis - Iniciantes", // obrigatório
  "descricao": "Aula para iniciantes...",
  "tipoAula": "GRUPO", // obrigatório: INDIVIDUAL, GRUPO ou TURMA
  "nivel": "INICIANTE", // INICIANTE, INTERMEDIARIO ou AVANCADO
  "maxAlunos": 4,
  "valorPorAluno": 50.00,
  "valorTotal": 200.00,
  "status": "AGENDADA",
  "dataInicio": "2024-12-01T10:00:00Z", // obrigatório (ISO string)
  "dataFim": "2024-12-01T11:00:00Z",
  "recorrenciaId": "uuid",
  "recorrenciaConfig": {
    "tipo": "SEMANAL",
    "intervalo": 1,
    "diasSemana": [1, 3, 5]
  },
  "observacoes": "Trazer raquete",
  "materialNecessario": "Raquete e bolas"
}
```

**Resposta:** 201 Created com objeto da aula criada

### GET /api/professor/aula/[id]
Busca aula por ID.

**Resposta:** 200 OK com objeto da aula completo

### PUT /api/professor/aula/[id]
Atualiza dados da aula.

**Body (todos os campos opcionais):**
```json
{
  "titulo": "Novo título",
  "descricao": "Nova descrição",
  "tipoAula": "TURMA",
  "nivel": "INTERMEDIARIO",
  "maxAlunos": 8,
  "valorPorAluno": 40.00,
  "status": "CONFIRMADA",
  "dataInicio": "2024-12-01T10:00:00Z",
  "dataFim": "2024-12-01T11:00:00Z",
  "observacoes": "Novas observações",
  "materialNecessario": "Novo material"
}
```

**Resposta:** 200 OK com objeto da aula atualizada

---

## 👥 Rotas de Alunos

### GET /api/professor/aula/[id]/alunos
Lista alunos inscritos em uma aula.

**Resposta:**
```json
[
  {
    "id": "uuid",
    "aulaId": "uuid",
    "atletaId": "uuid",
    "statusInscricao": "CONFIRMADO",
    "presenca": true,
    "valorPago": 50.00,
    "valorDevido": 0.00,
    "inscritoEm": "2024-12-01T08:00:00Z",
    "atleta": {
      "id": "uuid",
      "nome": "Maria Silva",
      "fone": "(11) 99999-9999",
      "fotoUrl": "https://..."
    }
  }
]
```

### POST /api/professor/aula/[id]/alunos
Inscreve aluno em uma aula.

**Body:**
```json
{
  "atletaId": "uuid", // obrigatório
  "statusInscricao": "CONFIRMADO", // opcional
  "valorPago": 50.00, // opcional
  "valorDevido": 0.00 // opcional
}
```

**Validações:**
- Verifica se há vagas disponíveis
- Verifica se aluno já está inscrito

**Resposta:** 201 Created com objeto da inscrição

### POST /api/professor/aula/[id]/presenca
Marca presença de múltiplos alunos.

**Body:**
```json
{
  "presencas": [
    { "inscricaoId": "uuid", "presente": true },
    { "inscricaoId": "uuid", "presente": false },
    { "inscricaoId": "uuid", "presente": true }
  ]
}
```

**Resposta:** 200 OK com lista atualizada de alunos

### GET /api/professor/alunos
Lista alunos do professor (relação de longo prazo).

**Query Params (opcionais):**
- `apenasAtivos` (boolean, default: true): Filtrar apenas alunos ativos

**Resposta:**
```json
[
  {
    "id": "uuid",
    "professorId": "uuid",
    "atletaId": "uuid",
    "nivel": "INTERMEDIARIO",
    "observacoes": "Aluno dedicado",
    "ativo": true,
    "iniciadoEm": "2024-01-01T10:00:00Z",
    "atleta": {
      "id": "uuid",
      "nome": "João Silva",
      "fone": "(11) 99999-9999",
      "fotoUrl": "https://..."
    }
  }
]
```

### POST /api/professor/alunos
Cria relação professor-aluno (longo prazo).

**Body:**
```json
{
  "atletaId": "uuid", // obrigatório
  "nivel": "INICIANTE", // opcional
  "observacoes": "Aluno iniciante" // opcional
}
```

**Resposta:** 201 Created com objeto da relação criada

---

## 📊 Rotas de Avaliação

### GET /api/professor/aula/[id]/avaliacao
Lista avaliações de uma aula.

**Resposta:**
```json
[
  {
    "id": "uuid",
    "aulaId": "uuid",
    "professorId": "uuid",
    "atletaId": "uuid",
    "nota": 8.5,
    "comentario": "Aluno evoluindo muito bem",
    "pontosPositivos": "Melhorou técnica de saque",
    "pontosMelhorar": "Precisa trabalhar condicionamento",
    "tecnica": 9,
    "fisico": 7,
    "comportamento": 10,
    "avaliadoEm": "2024-12-01T12:00:00Z",
    "atleta": {
      "id": "uuid",
      "nome": "Maria Silva"
    }
  }
]
```

### POST /api/professor/aula/[id]/avaliacao
Cria avaliação de aluno em uma aula.

**Body:**
```json
{
  "atletaId": "uuid", // obrigatório
  "nota": 8.5, // opcional
  "comentario": "Aluno evoluindo bem", // opcional
  "pontosPositivos": "Técnica de saque", // opcional
  "pontosMelhorar": "Condicionamento", // opcional
  "tecnica": 9, // opcional (1-10)
  "fisico": 7, // opcional (1-10)
  "comportamento": 10 // opcional (1-10)
}
```

**Resposta:** 201 Created com objeto da avaliação criada

---

## 📝 Códigos de Status HTTP

- **200 OK**: Sucesso
- **201 Created**: Recurso criado com sucesso
- **400 Bad Request**: Dados inválidos ou faltando
- **403 Forbidden**: Acesso negado (sem permissão)
- **404 Not Found**: Recurso não encontrado
- **409 Conflict**: Conflito (ex: já existe, aula lotada)
- **500 Internal Server Error**: Erro interno do servidor

---

## 🔄 Fluxos Comuns

### 1. Criar Perfil de Professor
```
POST /api/professor
→ GET /api/professor/me (verificar)
```

### 2. Criar Aula
```
1. Criar Agendamento (módulo de agendamento existente)
2. POST /api/professor/aula (vinculando ao agendamento)
```

### 3. Inscrever Alunos em Aula
```
POST /api/professor/aula/[id]/alunos
→ GET /api/professor/aula/[id]/alunos (verificar inscrições)
```

### 4. Marcar Presença e Avaliar
```
POST /api/professor/aula/[id]/presenca
POST /api/professor/aula/[id]/avaliacao
```

---

## 🎯 Próximos Passos

1. ✅ Migration criada
2. ✅ Serviço (professorService.ts) implementado
3. ✅ Tipos TypeScript criados
4. ✅ Rotas API implementadas
5. ⏳ Testar todas as rotas
6. ⏳ Criar frontend (appprofessor)

---

## 📌 Notas Importantes

- Todas as datas devem estar no formato ISO 8601 (ex: `2024-12-01T10:00:00Z`)
- Valores monetários são em Decimal (ex: `150.00`)
- Validações de vagas são automáticas ao inscrever alunos
- PROFESSOR só pode gerenciar seus próprios dados
- ADMIN tem acesso total para gerenciamento

