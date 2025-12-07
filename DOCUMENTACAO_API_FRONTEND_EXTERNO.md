# 📚 Documentação da API - Frontend Externo (Aplicação do Atleta)

Esta documentação descreve todos os serviços disponíveis para o frontend externo (aplicação do atleta/usuário).

**Base URL:** `https://seu-dominio.com/api` (ou `http://localhost:3000/api` em desenvolvimento)

**Autenticação:** Todas as rotas (exceto login e registro público) requerem autenticação via JWT Bearer Token no header:
```
Authorization: Bearer <token>
```

---

## 🔐 1. Autenticação

### 1.1. Login

Autentica um usuário e retorna tokens JWT.

**Endpoint:** `POST /api/auth/login`

**Autenticação:** Não requerida

**Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Resposta de Sucesso (200):**
```json
{
  "usuario": {
    "id": "uuid",
    "nome": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "role": "USER",
    "atletaId": "uuid-ou-null",
    "pointIdGestor": null
  },
  "user": {
    // Mesmo objeto acima (alias para compatibilidade)
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Respostas de Erro:**
- `400`: `{ "mensagem": "Informe email e senha." }`
- `401`: `{ "mensagem": "Usuário não encontrado" }` ou `{ "mensagem": "Senha incorreta" }`
- `500`: `{ "mensagem": "Erro ao efetuar login", "error": "..." }`

---

### 1.2. Criar Conta (Registro Público)

Cria uma nova conta de usuário. Disponível publicamente.

**Endpoint:** `POST /api/auth/register-public`

**Autenticação:** Não requerida

**Body:**
```json
{
  "name": "Nome do Usuário",
  "email": "novo@exemplo.com",
  "password": "senha123"
}
```

**Resposta de Sucesso (201):**
```json
{
  "user": {
    "id": "uuid",
    "name": "Nome do Usuário",
    "email": "novo@exemplo.com",
    "role": "USER"
  },
  "mensagem": "Conta criada com sucesso"
}
```

**Respostas de Erro:**
- `400`: `{ "mensagem": "Nome, email e senha são obrigatórios" }` ou `{ "mensagem": "E-mail já cadastrado" }`

---

### 1.3. Obter Usuário Atual

Retorna os dados do usuário autenticado.

**Endpoint:** `GET /api/auth/me`

**Autenticação:** Requerida (JWT Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "id": "uuid",
  "nome": "Nome do Usuário",
  "email": "usuario@exemplo.com",
  "role": "USER",
  "atletaId": "uuid-ou-null",
  "pointIdGestor": null
}
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`

---

## 🏟️ 2. Points (Arenas)

### 2.1. Listar Arenas Ativas (Público)

Lista todas as arenas (points) ativas disponíveis. **Esta é uma rota pública que não requer autenticação e retorna apenas informações públicas (sem dados sensíveis).**

**Endpoint:** `GET /api/point/public?apenasAtivos=true`

**Autenticação:** Não requerida (rota pública)

**Query Parameters:**
- `apenasAtivos` (opcional): `true` para retornar apenas arenas ativas. **Padrão: `true`** (apenas arenas ativas são retornadas por padrão). Use `apenasAtivos=false` para listar todas as arenas (incluindo inativas).

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "nome": "Arena Exemplo",
    "endereco": "Rua Exemplo, 123",
    "telefone": "(11) 99999-9999",
    "email": "contato@arena.com",
    "descricao": "Descrição da arena",
    "logoUrl": "https://...",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "ativo": true,
    "assinante": false
  }
]
```

**Nota:** Esta rota retorna apenas campos públicos. Dados sensíveis (como tokens WhatsApp) não são incluídos.

**Respostas de Erro:**
- `500`: `{ "mensagem": "Erro ao listar arenas", "error": "..." }`

---

### 2.2. Obter Arena por ID

Retorna os detalhes de uma arena específica.

**Endpoint:** `GET /api/point/{id}`

**Autenticação:** Requerida (JWT Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "id": "uuid",
  "nome": "Arena Exemplo",
  "endereco": "Rua Exemplo, 123",
  "telefone": "(11) 99999-9999",
  "email": "contato@arena.com",
  "descricao": "Descrição da arena",
  "logoUrl": "https://...",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "ativo": true,
  "assinante": false,
  "whatsappAtivo": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `404`: `{ "mensagem": "Arena não encontrada" }`

---

## 🏓 3. Quadras

### 3.1. Listar Quadras

Lista as quadras disponíveis, opcionalmente filtradas por arena (pointId).

**Endpoint:** `GET /api/quadra?pointId={pointId}`

**Autenticação:** Requerida (JWT Bearer Token)

**Query Parameters:**
- `pointId` (opcional): ID da arena para filtrar quadras. **Recomendado usar sempre para o frontend externo.**

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "nome": "Quadra 1",
    "pointId": "uuid-da-arena",
    "tipo": "Saibro",
    "capacidade": 4,
    "ativo": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "point": {
      "id": "uuid-da-arena",
      "nome": "Arena Exemplo"
    }
  }
]
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `500`: `{ "mensagem": "Erro ao listar quadras", "error": "..." }`

---

## 📅 4. Agendamentos

### 4.1. Listar Agendamentos

Lista agendamentos com filtros opcionais. Usuários comuns veem apenas seus próprios agendamentos.

**Endpoint:** `GET /api/agendamento`

**Autenticação:** Requerida (JWT Bearer Token)

**Query Parameters:**
- `pointId` (opcional): ID da arena para filtrar agendamentos
- `quadraId` (opcional): ID da quadra para filtrar agendamentos
- `dataInicio` (opcional): Data inicial no formato ISO string UTC (ex: `2024-01-15T00:00:00.000Z`)
- `dataFim` (opcional): Data final no formato ISO string UTC (ex: `2024-01-15T23:59:59.999Z`)
- `status` (opcional): `CONFIRMADO`, `CANCELADO` ou `CONCLUIDO`
- `apenasMeus` (opcional): `true` para retornar apenas agendamentos do usuário autenticado

**Exemplo:**
```
GET /api/agendamento?pointId=uuid&apenasMeus=true&status=CONFIRMADO
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "quadraId": "uuid",
    "usuarioId": "uuid",
    "atletaId": "uuid-ou-null",
    "nomeAvulso": null,
    "telefoneAvulso": null,
    "dataHora": "2024-01-15T14:00:00.000Z",
    "duracao": 60,
    "valorHora": 50.00,
    "valorCalculado": 50.00,
    "valorNegociado": null,
    "status": "CONFIRMADO",
    "observacoes": "Observações do agendamento",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "quadra": {
      "id": "uuid",
      "nome": "Quadra 1",
      "pointId": "uuid",
      "point": {
        "id": "uuid",
        "nome": "Arena Exemplo"
      }
    },
    "usuario": {
      "id": "uuid",
      "name": "Nome do Usuário",
      "email": "usuario@exemplo.com"
    },
    "atleta": {
      "id": "uuid",
      "nome": "Nome do Atleta",
      "fone": "(11) 99999-9999",
      "usuarioId": "uuid"
    },
    "atletasParticipantes": [
      {
        "id": "uuid",
        "atletaId": "uuid",
        "atleta": {
          "id": "uuid",
          "nome": "Atleta Participante",
          "fone": "(11) 99999-9999",
          "usuarioId": "uuid",
          "usuario": {
            "id": "uuid",
            "name": "Nome do Usuário",
            "email": "usuario@exemplo.com"
          }
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
]
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `500`: `{ "mensagem": "Erro ao listar agendamentos", "error": "..." }`

---

### 4.2. Obter Agendamento por ID

Retorna os detalhes de um agendamento específico.

**Endpoint:** `GET /api/agendamento/{id}`

**Autenticação:** Requerida (JWT Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "id": "uuid",
  "quadraId": "uuid",
  "usuarioId": "uuid",
  "atletaId": "uuid-ou-null",
  "nomeAvulso": null,
  "telefoneAvulso": null,
  "dataHora": "2024-01-15T14:00:00.000Z",
  "duracao": 60,
  "valorHora": 50.00,
  "valorCalculado": 50.00,
  "valorNegociado": null,
  "status": "CONFIRMADO",
  "observacoes": "Observações do agendamento",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "quadra": {
    "id": "uuid",
    "nome": "Quadra 1",
    "pointId": "uuid",
    "point": {
      "id": "uuid",
      "nome": "Arena Exemplo"
    }
  },
  "usuario": {
    "id": "uuid",
    "name": "Nome do Usuário",
    "email": "usuario@exemplo.com"
  },
  "atleta": {
    "id": "uuid",
    "nome": "Nome do Atleta",
    "fone": "(11) 99999-9999",
    "usuarioId": "uuid"
  },
  "atletasParticipantes": [
    // Array de atletas participantes (mesmo formato do listar)
  ]
}
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `403`: `{ "mensagem": "Você não tem permissão para visualizar este agendamento" }`
- `404`: `{ "mensagem": "Agendamento não encontrado" }`

---

### 4.3. Criar Agendamento

Cria um novo agendamento. **Importante:** O atleta deve selecionar o `pointId` (arena) e depois a `quadraId`.

**Endpoint:** `POST /api/agendamento`

**Autenticação:** Requerida (JWT Bearer Token)

**Body:**
```json
{
  "quadraId": "uuid-da-quadra",
  "dataHora": "2024-01-15T14:00:00",
  "duracao": 60,
  "observacoes": "Observações opcionais",
  "atletasParticipantesIds": ["uuid-atleta1", "uuid-atleta2"],
  "recorrencia": {
    "tipo": "SEMANAL",
    "intervalo": 1,
    "diasSemana": [1, 3, 5],
    "dataFim": "2024-12-31T23:59:59.000Z",
    "quantidadeOcorrencias": 10
  }
}
```

**Campos:**
- `quadraId` (obrigatório): ID da quadra selecionada
- `dataHora` (obrigatório): Data e hora no formato `YYYY-MM-DDTHH:mm` (horário local do usuário)
- `duracao` (opcional): Duração em minutos (padrão: 60)
- `observacoes` (opcional): Observações do agendamento
- `atletasParticipantesIds` (opcional): Array de IDs dos atletas que participarão do agendamento
- `recorrencia` (opcional): Configuração de recorrência
  - `tipo`: `"DIARIO"`, `"SEMANAL"` ou `"MENSAL"`
  - `intervalo` (para SEMANAL): 1 = toda semana, 2 = a cada 2 semanas, etc.
  - `diasSemana` (para SEMANAL): Array de números (0=domingo, 1=segunda, etc.)
  - `diaMes` (para MENSAL): Dia do mês (1-31)
  - `dataFim` (opcional): Data de término da recorrência (ISO string)
  - `quantidadeOcorrencias` (opcional): Número máximo de ocorrências

**Resposta de Sucesso (201):**
```json
{
  "id": "uuid",
  "quadraId": "uuid",
  "usuarioId": "uuid",
  "atletaId": "uuid-ou-null",
  "dataHora": "2024-01-15T14:00:00.000Z",
  "duracao": 60,
  "valorHora": 50.00,
  "valorCalculado": 50.00,
  "valorNegociado": null,
  "status": "CONFIRMADO",
  "observacoes": "Observações opcionais",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "quadra": {
    "id": "uuid",
    "nome": "Quadra 1",
    "pointId": "uuid",
    "point": {
      "id": "uuid",
      "nome": "Arena Exemplo"
    }
  },
  "usuario": {
    "id": "uuid",
    "name": "Nome do Usuário",
    "email": "usuario@exemplo.com"
  },
  "atleta": {
    "id": "uuid",
    "nome": "Nome do Atleta",
    "fone": "(11) 99999-9999"
  },
  "atletasParticipantes": [
    // Array de atletas participantes
  ]
}
```

**Respostas de Erro:**
- `400`: `{ "mensagem": "Quadra e data/hora são obrigatórios" }` ou `{ "mensagem": "Já existe um agendamento confirmado neste horário" }`
- `401`: `{ "mensagem": "Não autenticado" }`
- `404`: `{ "mensagem": "Quadra não encontrada" }`
- `500`: `{ "mensagem": "Erro ao criar agendamento", "error": "..." }`

---

### 4.4. Atualizar Agendamento

Atualiza um agendamento existente. Usuários comuns só podem atualizar seus próprios agendamentos.

**Endpoint:** `PUT /api/agendamento/{id}`

**Autenticação:** Requerida (JWT Bearer Token)

**Body:**
```json
{
  "quadraId": "uuid-da-quadra",
  "dataHora": "2024-01-15T15:00:00",
  "duracao": 90,
  "observacoes": "Observações atualizadas",
  "atletasParticipantesIds": ["uuid-atleta1"],
  "aplicarARecorrencia": false
}
```

**Campos:**
- Todos os campos são opcionais (apenas os fornecidos serão atualizados)
- `aplicarARecorrencia` (opcional): `true` para aplicar mudanças a todos os agendamentos futuros da recorrência, `false` para atualizar apenas este

**Resposta de Sucesso (200):**
```json
{
  // Mesmo formato do agendamento criado
}
```

**Respostas de Erro:**
- `400`: `{ "mensagem": "Já existe um agendamento confirmado neste horário para esta quadra" }`
- `401`: `{ "mensagem": "Não autenticado" }`
- `403`: `{ "mensagem": "Você não tem permissão para editar este agendamento" }`
- `404`: `{ "mensagem": "Agendamento não encontrado" }`

---

### 4.5. Cancelar Agendamento

Cancela um agendamento. Usuários comuns só podem cancelar seus próprios agendamentos.

**Endpoint:** `DELETE /api/agendamento/{id}`

**Autenticação:** Requerida (JWT Bearer Token)

**Body (opcional):**
```json
{
  "aplicarARecorrencia": false
}
```

**Resposta de Sucesso (200):**
```json
{
  "mensagem": "Agendamento deletado com sucesso"
}
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `403`: `{ "mensagem": "Você não tem permissão para deletar este agendamento" }`
- `404`: `{ "mensagem": "Agendamento não encontrado" }`

---

## 🎾 5. Partidas

### 5.1. Listar Partidas

Lista todas as partidas cadastradas. O frontend deve filtrar as partidas do atleta autenticado.

**Endpoint:** `GET /api/partida/listarPartidas`

**Autenticação:** Requerida (JWT Bearer Token)

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid",
    "data": "2024-01-15T14:00:00.000Z",
    "local": "Arena Exemplo - Quadra 1",
    "gamesTime1": 6,
    "gamesTime2": 4,
    "tiebreakTime1": 7,
    "tiebreakTime2": 5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "atleta1": {
      "id": "uuid",
      "nome": "Atleta 1"
    },
    "atleta2": {
      "id": "uuid",
      "nome": "Atleta 2"
    },
    "atleta3": {
      "id": "uuid",
      "nome": "Atleta 3"
    },
    "atleta4": {
      "id": "uuid",
      "nome": "Atleta 4"
    }
  }
]
```

**Nota:** O campo `local` é uma string livre. **Recomendação:** No frontend externo, considere adicionar `pointId` nas partidas futuras para melhor organização.

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `500`: `{ "erro": "Erro ao listar partidas" }`

---

### 5.2. Criar Partida

Cria uma nova partida. **Importante:** O campo `local` deve incluir informações da arena selecionada.

**Endpoint:** `POST /api/partida/criarPartida`

**Autenticação:** Requerida (JWT Bearer Token)

**Body:**
```json
{
  "data": "2024-01-15T14:00:00.000Z",
  "local": "Arena Exemplo - Quadra 1",
  "atleta1Id": "uuid",
  "atleta2Id": "uuid",
  "atleta3Id": "uuid-ou-null",
  "atleta4Id": "uuid-ou-null",
  "gamesTime1": 6,
  "gamesTime2": 4,
  "tiebreakTime1": 7,
  "tiebreakTime2": 5
}
```

**Campos:**
- `data` (obrigatório): Data da partida no formato ISO string
- `local` (obrigatório): Local da partida (string livre - **recomendado incluir nome da arena e quadra**)
- `atleta1Id` (obrigatório): ID do primeiro atleta
- `atleta2Id` (obrigatório): ID do segundo atleta
- `atleta3Id` (opcional): ID do terceiro atleta (para duplas)
- `atleta4Id` (opcional): ID do quarto atleta (para duplas)
- `gamesTime1` (opcional): Games do time 1
- `gamesTime2` (opcional): Games do time 2
- `tiebreakTime1` (opcional): Tiebreak do time 1
- `tiebreakTime2` (opcional): Tiebreak do time 2

**Resposta de Sucesso (201):**
```json
{
  "id": "uuid",
  "data": "2024-01-15T14:00:00.000Z",
  "local": "Arena Exemplo - Quadra 1",
  "gamesTime1": 6,
  "gamesTime2": 4,
  "tiebreakTime1": 7,
  "tiebreakTime2": 5,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "atleta1": {
    "id": "uuid",
    "nome": "Atleta 1"
  },
  "atleta2": {
    "id": "uuid",
    "nome": "Atleta 2"
  },
  "atleta3": null,
  "atleta4": null
}
```

**Respostas de Erro:**
- `400`: `{ "error": "Atleta1Id e Atleta2Id são obrigatórios" }`
- `401`: `{ "mensagem": "Não autenticado" }`
- `500`: `{ "error": "Erro ao criar partida" }`

---

### 5.3. Atualizar Placar da Partida

Atualiza o placar de uma partida. Apenas participantes da partida podem atualizar.

**Endpoint:** `PUT /api/partida/{id}`

**Autenticação:** Requerida (JWT Bearer Token)

**Body:**
```json
{
  "gamesTime1": 6,
  "gamesTime2": 4,
  "tiebreakTime1": 7,
  "tiebreakTime2": 5
}
```

**Campos:**
- Todos os campos são opcionais (apenas os fornecidos serão atualizados)

**Resposta de Sucesso (200):**
```json
{
  // Mesmo formato da partida criada
}
```

**Respostas de Erro:**
- `400`: `{ "mensagem": "gamesTime1 deve ser um número não negativo" }`
- `401`: `{ "mensagem": "Não autenticado" }`
- `403`: `{ "mensagem": "Você não tem permissão para atualizar o placar desta partida" }`
- `404`: `{ "mensagem": "Partida não encontrada" }`

---

## 👤 6. Perfil do Atleta

### 6.1. Obter Perfil do Atleta

Retorna o perfil do atleta vinculado ao usuário autenticado.

**Endpoint:** `GET /api/atleta/me/atleta`

**Autenticação:** Requerida (JWT Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "id": "uuid",
  "nome": "Nome do Atleta",
  "dataNascimento": "1990-01-01T00:00:00.000Z",
  "genero": "MASCULINO",
  "categoria": "A",
  "idade": 34,
  "fotoUrl": "https://...",
  "fone": "(11) 99999-9999",
  "usuarioId": "uuid",
  "pointIdPrincipal": "uuid-ou-null",
  "arenasFrequentes": [
    {
      "id": "uuid",
      "nome": "Arena Exemplo",
      "logoUrl": "https://..."
    }
  ],
  "arenaPrincipal": {
    "id": "uuid",
    "nome": "Arena Exemplo",
    "logoUrl": "https://..."
  },
  "assinante": false
}
```

**Resposta quando não tem atleta (204):**
- Status: `204 No Content` (sem body)

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `500`: `{ "mensagem": "Erro ao buscar atleta" }`

---

### 6.2. Criar Perfil de Atleta

Cria um perfil de atleta para o usuário autenticado.

**Endpoint:** `POST /api/atleta/criarAtleta`

**Autenticação:** Requerida (JWT Bearer Token)

**Body:**
```json
{
  "nome": "Nome do Atleta",
  "dataNascimento": "1990-01-01",
  "categoria": "A",
  "genero": "MASCULINO",
  "fone": "(11) 99999-9999",
  "fotoUrl": "data:image/jpeg;base64,...",
  "pointIdPrincipal": "uuid-ou-null",
  "pointIdsFrequentes": ["uuid1", "uuid2"]
}
```

**Campos:**
- `nome` (obrigatório): Nome completo do atleta
- `dataNascimento` (obrigatório): Data de nascimento no formato `YYYY-MM-DD`
- `categoria` (opcional): Categoria do atleta (`INICIANTE`, `D`, `C`, `B`, `A`, `PRO`)
- `genero` (opcional): `MASCULINO`, `FEMININO` ou `OUTRO`
- `fone` (opcional): Telefone do atleta
- `fotoUrl` (opcional): Foto em base64 (`data:image/...`) ou URL
- `pointIdPrincipal` (opcional): ID da arena principal do atleta
- `pointIdsFrequentes` (opcional): Array de IDs das arenas frequentes

**Resposta de Sucesso (201):**
```json
{
  "id": "uuid",
  "nome": "Nome do Atleta",
  "dataNascimento": "1990-01-01T00:00:00.000Z",
  "genero": "MASCULINO",
  "categoria": "A",
  "idade": 34,
  "fotoUrl": "https://...",
  "fone": "(11) 99999-9999",
  "usuarioId": "uuid",
  "pointIdPrincipal": "uuid",
  "arenasFrequentes": [
    {
      "id": "uuid",
      "nome": "Arena Exemplo",
      "logoUrl": "https://..."
    }
  ],
  "arenaPrincipal": {
    "id": "uuid",
    "nome": "Arena Exemplo",
    "logoUrl": "https://..."
  }
}
```

**Respostas de Erro:**
- `400`: `{ "mensagem": "nome e dataNascimento são obrigatórios" }`
- `401`: `{ "mensagem": "Não autenticado" }`
- `500`: `{ "mensagem": "Erro ao criar atleta" }`

---

### 6.3. Atualizar Perfil de Atleta

Atualiza o perfil do atleta.

**Endpoint:** `PUT /api/atleta/{id}`

**Autenticação:** Requerida (JWT Bearer Token)

**Body:**
```json
{
  "nome": "Nome Atualizado",
  "dataNascimento": "1990-01-01",
  "categoria": "B",
  "genero": "MASCULINO",
  "fone": "(11) 99999-9999",
  "fotoUrl": "https://...",
  "pointIdPrincipal": "uuid",
  "pointIdsFrequentes": ["uuid1", "uuid2"]
}
```

**Campos:**
- Todos os campos são opcionais (apenas os fornecidos serão atualizados)

**Resposta de Sucesso (200):**
```json
{
  // Mesmo formato do perfil do atleta
}
```

**Respostas de Erro:**
- `401`: `{ "mensagem": "Não autenticado" }`
- `404`: `{ "mensagem": "Atleta não encontrado" }`

---

## 📋 7. Fluxo Recomendado para o Frontend Externo

### 7.1. Fluxo de Autenticação

1. **Criar Conta:** `POST /api/auth/register-public`
2. **Login:** `POST /api/auth/login` → Salvar o `token` retornado
3. **Verificar Usuário:** `GET /api/auth/me` (opcional, para validar token)
4. **Verificar Perfil de Atleta:** `GET /api/atleta/me/atleta`
   - Se retornar `204`, o usuário ainda não tem perfil de atleta
   - Se retornar `200`, exibir dados do atleta

### 7.2. Fluxo de Seleção de Arena

1. **Listar Arenas Ativas:** `GET /api/point/public?apenasAtivos=true` (rota pública, sem autenticação)
2. **Selecionar Arena:** Guardar o `pointId` selecionado
3. **Listar Quadras da Arena:** `GET /api/quadra?pointId={pointId}` (requer autenticação)
4. **Selecionar Quadra:** Guardar o `quadraId` selecionado

### 7.3. Fluxo de Agendamento

1. **Selecionar Arena e Quadra** (usar fluxo acima)
2. **Criar Agendamento:** `POST /api/agendamento` com `quadraId` selecionado
3. **Listar Meus Agendamentos:** `GET /api/agendamento?apenasMeus=true&pointId={pointId}`
4. **Atualizar/Cancelar:** `PUT /api/agendamento/{id}` ou `DELETE /api/agendamento/{id}`

### 7.4. Fluxo de Partidas

1. **Criar Partida:** `POST /api/partida/criarPartida`
   - Incluir nome da arena no campo `local` (ex: "Arena Exemplo - Quadra 1")
2. **Listar Partidas:** `GET /api/partida/listarPartidas`
   - Filtrar no frontend as partidas onde o atleta participa
3. **Atualizar Placar:** `PUT /api/partida/{id}`

---

## 🔒 8. Códigos de Status HTTP

- `200`: Sucesso
- `201`: Criado com sucesso
- `204`: Sucesso sem conteúdo (ex: atleta não encontrado)
- `400`: Erro de validação (dados inválidos)
- `401`: Não autenticado (token inválido ou ausente)
- `403`: Acesso negado (sem permissão)
- `404`: Recurso não encontrado
- `500`: Erro interno do servidor

---

## 📝 9. Observações Importantes

1. **Arenas Ativas:** Use a rota pública `/api/point/public?apenasAtivos=true` para listar arenas. Por padrão, apenas arenas ativas são retornadas. Esta rota não requer autenticação e não expõe dados sensíveis.

2. **Seleção de Arena:** Em todas as operações que envolvem arenas (agendamentos e partidas), o atleta deve selecionar a arena desejada primeiro.

3. **Filtros de Agendamento:** Use `apenasMeus=true` para listar apenas agendamentos do usuário autenticado.

4. **Formato de Data/Hora:**
   - Para agendamentos: `YYYY-MM-DDTHH:mm` (ex: `2024-01-15T14:00`)
   - Para partidas: ISO string completa (ex: `2024-01-15T14:00:00.000Z`)

5. **Atletas Participantes:** Ao criar agendamento, você pode incluir outros atletas usando `atletasParticipantesIds`.

6. **Recorrência:** Agendamentos podem ser recorrentes (diário, semanal, mensal) usando o campo `recorrencia`.

7. **Permissões:** Usuários comuns (role `USER`) só podem:
   - Ver e editar seus próprios agendamentos
   - Atualizar placar de partidas onde participam
   - Ver e editar seu próprio perfil de atleta

---

## 🔄 10. Exemplo de Uso Completo

```javascript
// 1. Criar conta
const registerResponse = await fetch('/api/auth/register-public', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'João Silva',
    email: 'joao@exemplo.com',
    password: 'senha123'
  })
});

// 2. Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'joao@exemplo.com',
    password: 'senha123'
  })
});
const { token } = await loginResponse.json();

// 3. Listar arenas ativas (rota pública, sem autenticação)
const arenasResponse = await fetch('/api/point/public?apenasAtivos=true');
const arenas = await arenasResponse.json();

// 4. Selecionar arena e listar quadras
const pointId = arenas[0].id;
const quadrasResponse = await fetch(`/api/quadra?pointId=${pointId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const quadras = await quadrasResponse.json();

// 5. Criar agendamento
const agendamentoResponse = await fetch('/api/agendamento', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    quadraId: quadras[0].id,
    dataHora: '2024-01-15T14:00',
    duracao: 60
  })
});
const agendamento = await agendamentoResponse.json();
```

---

**Última atualização:** Janeiro 2024

