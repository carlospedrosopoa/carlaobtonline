# Visão Geral do Sistema - Carlaobtonline

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura e Stack Tecnológica](#arquitetura-e-stack-tecnológica)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Funcionalidades Principais](#funcionalidades-principais)
5. [Regras de Negócio Importantes](#regras-de-negócio-importantes)
6. [Sistema de Permissões](#sistema-de-permissões)
7. [Fluxos Principais](#fluxos-principais)
8. [Configurações e Variáveis de Ambiente](#configurações-e-variáveis-de-ambiente)
9. [Integrações Externas](#integrações-externas)
10. [Pontos de Atenção e Gotchas](#pontos-de-atenção-e-gotchas)
11. [Documentação Relacionada](#documentação-relacionada)

---

## 🎯 Visão Geral

**Carlaobtonline** é uma plataforma completa para gestão de arenas esportivas, incluindo:

- **Agendamento de Quadras**: Sistema completo de reservas com recorrência, bloqueios e múltiplos participantes
- **Gestão de Arena**: Sistema de caixa, produtos, pagamentos e cards de clientes
- **Integração WhatsApp**: Notificações automáticas via WhatsApp Business API e Gzappy
- **Geração de Cards**: Sistema de geração de cards de partidas com templates personalizados
- **Múltiplos Perfis**: Suporte para ADMIN, ORGANIZER (gestor de arena) e USER (atleta)

### Projetos Relacionados

- **carlaobtonline**: API principal e interface administrativa (este projeto)
- **appatleta**: Frontend externo focado na experiência do usuário final (atleta)

---

## 🏗️ Arquitetura e Stack Tecnológica

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS 4
- **Componentes UI**: Radix UI + componentes customizados
- **Gerenciamento de Estado**: React Context API (AuthContext)
- **HTTP Client**: Axios

### Backend
- **Framework**: Next.js API Routes
- **Banco de Dados**: PostgreSQL
- **ORM/Query**: Queries SQL diretas com `pg`
- **Autenticação**: JWT (JSON Web Tokens)
- **Upload de Arquivos**: Google Cloud Storage

### Infraestrutura
- **Deploy**: Vercel
- **Banco de Dados**: PostgreSQL (provavelmente Vercel Postgres ou externo)
- **Storage**: Google Cloud Storage (para imagens e templates)

### Principais Dependências
```json
{
  "next": "^16.0.7",
  "react": "^19.2.1",
  "typescript": "^5",
  "pg": "^8.16.3",
  "jsonwebtoken": "^9.0.2",
  "@google-cloud/storage": "^7.14.0",
  "canvas": "^3.2.0",
  "axios": "^1.13.2",
  "date-fns": "^4.1.0"
}
```

---

## 📁 Estrutura de Pastas

```
carlaobtonline/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                 # API Routes (Backend)
│   │   │   ├── agendamento/     # Endpoints de agendamentos
│   │   │   ├── gestao-arena/    # Endpoints de gestão (caixa, produtos, etc)
│   │   │   ├── auth/            # Autenticação
│   │   │   ├── whatsapp/        # Integração WhatsApp
│   │   │   └── ...
│   │   └── app/                 # Páginas da aplicação
│   │       ├── admin/            # Área administrativa
│   │       ├── arena/            # Área do gestor de arena
│   │       └── atleta/           # Área do atleta
│   ├── components/               # Componentes React
│   │   ├── ui/                  # Componentes UI base (Radix UI)
│   │   └── ...                  # Componentes específicos
│   ├── lib/                      # Bibliotecas e utilitários
│   │   ├── db.ts                # Conexão com banco de dados
│   │   ├── auth.ts              # Funções de autenticação
│   │   ├── cors.ts              # Configuração CORS
│   │   ├── generateCard.ts      # Geração de cards
│   │   └── ...
│   ├── services/                 # Serviços de comunicação com API
│   ├── types/                    # Definições TypeScript
│   │   ├── agendamento.ts
│   │   ├── gestaoArena.ts
│   │   └── domain.ts
│   └── context/                  # React Contexts
│       └── AuthContext.tsx
├── scripts/                      # Scripts SQL e migrações
├── public/                        # Arquivos estáticos
└── [documentação .md]            # Documentação do projeto
```

---

## 🚀 Funcionalidades Principais

### 1. Sistema de Agendamentos

#### Funcionalidades
- ✅ Criação, edição e cancelamento de agendamentos
- ✅ Agendamentos recorrentes (diário, semanal, mensal)
- ✅ Múltiplos participantes por agendamento
- ✅ Agendamentos avulsos (sem usuário cadastrado)
- ✅ Bloqueios de agenda (períodos indisponíveis)
- ✅ Cálculo automático de valores baseado em tabela de preços
- ✅ Valores negociados (para ADMIN/ORGANIZER)
- ✅ Validação de conflitos de horário
- ✅ Agenda semanal visual

#### Regras Importantes
- **Validação de 12 horas**: Usuários comuns não podem alterar data/hora/duração com menos de 12 horas de antecedência
- **Agendamentos retroativos**: ADMIN e ORGANIZER podem criar/editar agendamentos no passado
- **Recorrência**: Suporta recorrência diária, semanal e mensal com configurações flexíveis

### 2. Gestão de Arena

#### Cards de Cliente
- ✅ Criação de cards para clientes (usuários ou avulsos)
- ✅ Adição de itens (produtos) ao card
- ✅ Registro de pagamentos
- ✅ Status: ABERTO, FECHADO, CANCELADO
- ✅ Reabertura de cards (ADMIN/ORGANIZER)
- ✅ Venda rápida (card + itens + pagamento em uma operação)

#### Caixa
- ✅ Abertura e fechamento de caixa
- ✅ Entradas e saídas de caixa
- ✅ Categorização de saídas
- ✅ Centro de custo
- ✅ Histórico de caixas fechados
- ✅ Dashboard de caixa

#### Produtos e Formas de Pagamento
- ✅ Cadastro de produtos
- ✅ Formas de pagamento configuráveis
- ✅ Tabela de preços por horário

### 3. Integração WhatsApp

#### Funcionalidades
- ✅ Notificações automáticas de agendamentos
- ✅ Suporte para WhatsApp Business API (Meta)
- ✅ Suporte para Gzappy
- ✅ Configuração por Point (estabelecimento)
- ✅ Webhook para recebimento de mensagens

### 4. Geração de Cards de Partidas

#### Funcionalidades
- ✅ Geração de cards visuais de partidas
- ✅ Templates personalizáveis (Google Cloud Storage)
- ✅ Upload de templates
- ✅ Geração programática (Canvas)

---

## 📐 Regras de Negócio Importantes

### Agendamentos

1. **Validação de 12 horas**
   - Usuários comuns (USER) não podem alterar data/hora/duração com menos de 12 horas
   - ADMIN e ORGANIZER podem fazer alterações a qualquer momento
   - Aplicado apenas quando realmente há alteração de data/hora/duração

2. **Agendamentos Retroativos**
   - Por padrão, não é permitido criar agendamentos no passado
   - ADMIN e ORGANIZER podem criar/editar agendamentos retroativos
   - Validação no frontend (`EditarAgendamentoModal.tsx`) e backend

3. **Conflitos de Horário**
   - Sistema verifica conflitos antes de criar/editar agendamentos
   - Considera bloqueios de agenda
   - Considera outros agendamentos confirmados

4. **Recorrência**
   - Suporta recorrência diária, semanal e mensal
   - Ao editar agendamento recorrente, pode aplicar apenas ao atual ou a todos os futuros
   - Ao cancelar, pode cancelar apenas o atual ou todos os futuros

### Cards de Cliente

1. **Fechamento de Card**
   - Card só pode ser fechado se saldo for zero (total pago = valor total)
   - ADMIN e ORGANIZER podem reabrir cards fechados ou cancelados
   - Cards cancelados não podem receber novos itens ou pagamentos

2. **Status do Card**
   - **ABERTO**: Card ativo, pode receber itens e pagamentos
   - **FECHADO**: Card finalizado, saldo zerado
   - **CANCELADO**: Card cancelado, não pode ser modificado (exceto reabertura por ADMIN/ORGANIZER)

3. **Venda Rápida**
   - Cria card, adiciona itens e registra pagamento em uma única operação
   - Fecha o card automaticamente se saldo for zero

### Caixa

1. **Abertura de Caixa**
   - Um caixa deve estar aberto para registrar pagamentos
   - Apenas um caixa pode estar aberto por vez por Point

2. **Fechamento de Caixa**
   - Ao fechar, calcula totais de entradas e saídas
   - Registra histórico para consulta posterior

---

## 👥 Sistema de Permissões

### Roles (Papéis)

1. **ADMIN**
   - Acesso total ao sistema
   - Pode gerenciar todos os Points, Quadras, Usuários
   - Pode criar agendamentos para qualquer atleta ou avulso
   - Pode fazer alterações sem restrições de tempo
   - Pode criar agendamentos retroativos
   - Pode reabrir cards fechados/cancelados

2. **ORGANIZER** (Gestor de Arena)
   - Gerencia apenas sua arena (Point vinculado via `pointIdGestor`)
   - Pode criar agendamentos para atletas ou avulsos
   - Pode fazer alterações sem restrições de tempo
   - Pode criar agendamentos retroativos
   - Pode reabrir cards fechados/cancelados
   - Acesso à gestão completa da arena (caixa, produtos, cards)

3. **USER** (Atleta)
   - Pode criar agendamentos apenas para si mesmo
   - Deve respeitar regra de 12 horas para alterações
   - Não pode criar agendamentos retroativos
   - Acesso limitado às funcionalidades

### Verificação de Permissões

- **Frontend**: `useAuth()` hook retorna `isAdmin`, `isOrganizer`, `canGerenciarAgendamento`
- **Backend**: Middleware `getUsuarioFromRequest()` valida JWT e retorna usuário
- **Validações**: Cada endpoint verifica permissões específicas

---

## 🔄 Fluxos Principais

### 1. Fluxo de Agendamento

```
1. Usuário seleciona quadra, data e hora
2. Sistema valida:
   - Data não está no passado (exceto ADMIN/ORGANIZER)
   - Não há conflitos de horário
   - Não há bloqueios no período
3. Sistema calcula valor baseado em tabela de preços
4. ADMIN/ORGANIZER pode negociar valor
5. Agendamento é criado
6. Se configurado, notificação WhatsApp é enviada
```

### 2. Fluxo de Card de Cliente

```
1. ORGANIZER cria card para cliente (usuário ou avulso)
2. Adiciona itens (produtos) ao card
3. Cliente faz pagamentos (parciais ou total)
4. Quando saldo = 0, card pode ser fechado
5. Card fechado não pode mais receber itens/pagamentos
6. ADMIN/ORGANIZER pode reabrir se necessário
```

### 3. Fluxo de Venda Rápida

```
1. ORGANIZER seleciona cliente
2. Adiciona produtos e quantidades
3. Seleciona forma de pagamento
4. Sistema cria:
   - Card
   - Itens
   - Pagamento
5. Se saldo = 0, fecha card automaticamente
```

### 4. Fluxo de Caixa

```
1. ORGANIZER abre caixa (com valor inicial)
2. Durante o dia:
   - Registra pagamentos de cards
   - Registra entradas (receitas)
   - Registra saídas (despesas)
3. Ao final do dia, fecha caixa
4. Sistema calcula totais e saldo final
5. Histórico fica disponível para consulta
```

---

## ⚙️ Configurações e Variáveis de Ambiente

### Obrigatórias

```env
# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@host:5432/database

# JWT Secret
JWT_SECRET=sua-chave-secreta-jwt
```

### Opcionais (mas recomendadas)

```env
# CORS - Domínios permitidos (produção)
ALLOWED_ORIGINS=https://appatleta.vercel.app,https://outro-dominio.com

# Google Cloud Storage (upload de imagens)
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=./path/to/key.json

# WhatsApp Business API (Meta)
META_WHATSAPP_ACCESS_TOKEN=seu_token
META_WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
META_WHATSAPP_BUSINESS_ACCOUNT_ID=seu_business_id
META_WHATSAPP_API_VERSION=v21.0
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_verify_token
```

📖 **Documentação completa**: Veja `VARIAVEIS_AMBIENTE.md`

---

## 🔌 Integrações Externas

### 1. WhatsApp Business API (Meta)

- **Propósito**: Envio de notificações automáticas
- **Configuração**: Por Point (cada arena pode ter sua própria configuração)
- **Documentação**: `GUIA_API_META.md`, `INTEGRACAO_WHATSAPP.md`

### 2. Gzappy

- **Propósito**: Alternativa ao WhatsApp Business API
- **Configuração**: Por Point
- **Campos**: `gzappyApiKey`, `gzappyInstanceId`, `gzappyAtivo`

### 3. Google Cloud Storage

- **Propósito**: Armazenamento de imagens (logos, templates de cards)
- **Configuração**: Via variáveis de ambiente
- **Documentação**: `GOOGLE_CLOUD_STORAGE_SETUP.md`

### 4. Google Geocoding API

- **Propósito**: Geocodificação de endereços (latitude/longitude)
- **Uso**: Endpoint `/api/geocode`

---

## ⚠️ Pontos de Atenção e Gotchas

### 1. Timezone e Datas

- **Problema**: Datas podem ter problemas de timezone
- **Solução**: Sistema trata datas como "naive" (sem timezone), gravando exatamente como informado
- **Cuidado**: Ao comparar datas, sempre considerar timezone local

### 2. Validação de 12 Horas

- **Problema**: Validação pode bloquear edições desnecessárias
- **Solução**: Frontend só envia `dataHora` se realmente alterou
- **Cuidado**: Verificar se `canGerenciarAgendamento` está sendo aplicado corretamente

### 3. CORS

- **Problema**: Frontend externo pode ter problemas de CORS
- **Solução**: Configurar `ALLOWED_ORIGINS` no Vercel
- **Documentação**: `VERCEL_CORS_SETUP.md`, `SOLUCAO_CORS_VERCEL.md`

### 4. Cards de Partidas

- **Problema**: Geração de cards pode falhar se template não estiver configurado
- **Solução**: Verificar se template está no Google Cloud Storage
- **Documentação**: `CARD_TEMPLATE_SETUP.md`, `TROUBLESHOOTING_TEMPLATE_CARD.md`

### 5. Recorrência

- **Problema**: Edição/cancelamento de agendamentos recorrentes pode ser confuso
- **Solução**: Sempre perguntar se aplica apenas ao atual ou a todos os futuros
- **Cuidado**: Verificar lógica de `aplicarARecorrencia`

### 6. Permissões

- **Problema**: ORGANIZER só tem acesso à sua arena
- **Solução**: Sempre verificar `pointIdGestor` do usuário
- **Cuidado**: Validações devem ser feitas tanto no frontend quanto no backend

### 7. Banco de Dados

- **Problema**: Queries SQL diretas podem ser vulneráveis a SQL injection
- **Solução**: Sempre usar parâmetros (`$1`, `$2`, etc.) nas queries
- **Cuidado**: Nunca concatenar strings diretamente em queries

### 8. Upload de Imagens

- **Problema**: Imagens grandes podem causar timeout
- **Solução**: Validar tamanho antes de upload
- **Cuidado**: Limitar tamanho máximo (ex: 5MB)

---

## 📚 Documentação Relacionada

### Documentação Principal
- `README.md` - Instruções gerais
- `VARIAVEIS_AMBIENTE.md` - Variáveis de ambiente
- `API_DOCUMENTATION.md` - Documentação da API
- `DOCUMENTACAO_API_FRONTEND_EXTERNO.md` - API para frontends externos

### Guias de Integração
- `INTEGRACAO_WHATSAPP.md` - Integração WhatsApp
- `GUIA_API_META.md` - Guia completo API Meta
- `GOOGLE_CLOUD_STORAGE_SETUP.md` - Setup GCS

### Guias de Deploy
- `DEPLOY_VERCEL.md` - Deploy no Vercel
- `VERCEL_CORS_SETUP.md` - Configuração CORS

### Migrações
- `MIGRACAO.md` - Migrações principais
- `MIGRACAO_RECORRENCIA.md` - Migração de recorrência
- `MIGRACAO_BLOQUEIO_AGENDA.md` - Migração de bloqueios

### Troubleshooting
- `SOLUCAO_CORS_VERCEL.md` - Solução de problemas CORS
- `TROUBLESHOOTING_TEMPLATE_CARD.md` - Problemas com cards

---

## 🎯 Próximos Passos para Novo Projeto

1. **Criar README.md** com visão geral do novo projeto
2. **Documentar arquitetura** e decisões técnicas
3. **Configurar ambiente** de desenvolvimento
4. **Listar dependências** e versões
5. **Documentar variáveis** de ambiente
6. **Criar guia** de contribuição (se for time)
7. **Manter este documento** atualizado conforme o sistema evolui

---

## 📝 Notas Finais

- Este documento deve ser atualizado conforme o sistema evolui
- Adicione novas funcionalidades, regras de negócio e pontos de atenção
- Mantenha links para documentação relacionada atualizados
- Use este documento como referência rápida para novos desenvolvedores

---

**Última atualização**: Dezembro 2024
**Versão do sistema**: Baseado em Next.js 16, React 19, TypeScript 5

