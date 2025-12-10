# 📁 Estrutura da API para Frontend Externo (Atletas/USER)

Esta documentação descreve a nova estrutura organizada da API para o frontend externo (aplicação do atleta).

## 🎯 Objetivo

Organizar todas as rotas do frontend externo sob o namespace `/api/user/` para:
- **Separação clara** entre rotas de usuários (USER) e rotas administrativas (ADMIN/ORGANIZER)
- **Melhor organização** e manutenibilidade do código
- **Facilidade de documentação** e onboarding
- **Escalabilidade** para futuras funcionalidades

## 📂 Estrutura de Diretórios

```
/api/user/
  ├── auth/
  │   ├── login          → POST   - Login de usuário
  │   ├── register       → POST   - Registro público de usuário
  │   └── me             → GET    - Obter usuário autenticado
  ├── arenas/
  │   └── listar         → GET    - Listar arenas assinantes e ativas
  ├── perfil/
  │   ├── atleta         → GET    - Obter perfil do atleta
  │   ├── criar          → POST   - Criar perfil de atleta
  │   └── atualizar      → PUT    - Atualizar perfil do atleta
  ├── agendamentos/      → (mantém /api/agendamento com validação USER)
  ├── partidas/          → (mantém /api/partida com validação USER)
  └── quadras/           → (mantém /api/quadra com validação USER)
```

## 🔄 Mapeamento de Rotas Antigas → Novas

| Rota Antiga (Deprecated) | Nova Rota | Status |
|---------------------------|-----------|--------|
| `POST /api/auth/login` | `POST /api/user/auth/login` | ✅ Nova |
| `POST /api/auth/register-public` | `POST /api/user/auth/register` | ✅ Nova |
| `GET /api/auth/me` | `GET /api/user/auth/me` | ✅ Nova |
| `GET /api/point/public` | `GET /api/user/arenas/listar` | ✅ Nova |
| `GET /api/atleta/me/atleta` | `GET /api/user/perfil/atleta` | ✅ Nova |
| `POST /api/atleta/criarAtleta` | `POST /api/user/perfil/criar` | ✅ Nova |
| `PUT /api/atleta/[id]` | `PUT /api/user/perfil/atualizar` | ✅ Nova |
| `GET /api/agendamento` | `GET /api/agendamento` | ⚠️ Mantida (com validação USER) |
| `POST /api/agendamento` | `POST /api/agendamento` | ⚠️ Mantida (com validação USER) |
| `GET /api/partida/listarPartidas` | `GET /api/partida/listarPartidas` | ⚠️ Mantida (com validação USER) |
| `POST /api/partida/criarPartida` | `POST /api/partida/criarPartida` | ⚠️ Mantida (com validação USER) |
| `GET /api/quadra` | `GET /api/quadra` | ⚠️ Mantida (com validação USER) |

## 📝 Rotas Implementadas

### 1. Autenticação (`/api/user/auth/`)

#### `POST /api/user/auth/login`
- **Descrição:** Login de usuário
- **Autenticação:** Não requerida
- **Body:**
  ```json
  {
    "email": "usuario@exemplo.com",
    "password": "senha123"
  }
  ```
- **Resposta:** Token JWT + dados do usuário

#### `POST /api/user/auth/register`
- **Descrição:** Registro público de usuário
- **Autenticação:** Não requerida
- **Body:**
  ```json
  {
    "name": "Nome do Usuário",
    "email": "novo@exemplo.com",
    "password": "senha123"
  }
  ```
- **Resposta:** Dados do usuário criado

#### `GET /api/user/auth/me`
- **Descrição:** Obter usuário autenticado
- **Autenticação:** Requerida (JWT Bearer Token)
- **Resposta:** Dados do usuário autenticado

### 2. Arenas (`/api/user/arenas/`)

#### `GET /api/user/arenas/listar`
- **Descrição:** Listar arenas assinantes e ativas
- **Autenticação:** Não requerida (rota pública)
- **Resposta:** Array de arenas (apenas campos públicos, sem tokens WhatsApp)
- **Filtros:** Apenas arenas com `assinante = true` e `ativo = true`

### 3. Perfil (`/api/user/perfil/`)

#### `GET /api/user/perfil/atleta`
- **Descrição:** Obter perfil do atleta do usuário autenticado
- **Autenticação:** Requerida (JWT Bearer Token)
- **Resposta:** Dados do atleta ou `204 No Content` se não tiver perfil

#### `POST /api/user/perfil/criar`
- **Descrição:** Criar perfil de atleta para o usuário autenticado
- **Autenticação:** Requerida (JWT Bearer Token)
- **Body:**
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
- **Resposta:** Dados do atleta criado

#### `PUT /api/user/perfil/atualizar`
- **Descrição:** Atualizar perfil do atleta do usuário autenticado
- **Autenticação:** Requerida (JWT Bearer Token)
- **Body:** Todos os campos são opcionais
- **Resposta:** Dados do atleta atualizado

## ⚠️ Compatibilidade com Rotas Antigas

Todas as rotas antigas foram mantidas e continuam funcionando para garantir compatibilidade durante a migração. Elas incluem avisos de deprecação nos comentários do código.

**Recomendação:** Migre gradualmente o frontend externo para usar as novas rotas. As rotas antigas serão removidas em uma versão futura.

## 🔒 Segurança

- Todas as rotas (exceto login, register e listar arenas) requerem autenticação via JWT Bearer Token
- As rotas de perfil garantem que o usuário só pode acessar/editar seu próprio perfil
- A rota de arenas retorna apenas dados públicos (sem tokens WhatsApp ou outras informações sensíveis)

## 📚 Documentação Completa

Para documentação completa com exemplos de uso, consulte:
- `DOCUMENTACAO_API_FRONTEND_EXTERNO.md` - Documentação completa da API

## 🚀 Próximos Passos

1. ✅ Estrutura `/api/user/` criada
2. ✅ Rotas de autenticação migradas
3. ✅ Rotas de perfil migradas
4. ✅ Rotas de arenas migradas
5. ⏳ Migrar rotas de agendamentos (opcional - podem permanecer em `/api/agendamento`)
6. ⏳ Migrar rotas de partidas (opcional - podem permanecer em `/api/partida`)
7. ⏳ Migrar rotas de quadras (opcional - podem permanecer em `/api/quadra`)
8. ⏳ Atualizar frontend externo para usar novas rotas
9. ⏳ Remover rotas antigas após migração completa

---

**Última atualização:** Janeiro 2024

