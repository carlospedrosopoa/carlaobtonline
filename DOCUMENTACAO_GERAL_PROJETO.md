# Documentacao Geral do Projeto

Este documento e o ponto de entrada para entender o projeto `carlaobtonline`.

Ele descreve:

- o que o sistema faz
- como frontend e API convivem no mesmo repositorio
- como a API atende tanto o frontend interno quanto aplicacoes externas
- onde ficam os principais modulos
- quais integracoes externas existem
- quais documentos complementares consultar

## 1. Visao geral

`carlaobtonline` e a plataforma principal do ecossistema Play Na Quadra.

O projeto concentra, no mesmo repositorio:

- frontend web interno para administracao e gestao de arenas
- frontend web para algumas experiencias de atleta dentro do proprio projeto
- API Next.js usada pelo frontend interno
- API consumida por aplicacoes externas, como frontend do atleta e integracoes parceiras

Em termos praticos, este projeto funciona como:

- backoffice administrativo
- sistema operacional da arena
- backend HTTP central do ecossistema

## 2. Stack principal

### Frontend

- Next.js 16 com App Router
- React 19
- TypeScript
- Tailwind CSS 4
- componentes base com Radix UI e componentes proprios

### Backend

- rotas API em `src/app/api`
- PostgreSQL via `pg`
- SQL direto, sem ORM
- autenticacao via JWT

### Infraestrutura

- deploy principal em Vercel
- banco PostgreSQL
- Google Cloud Storage para arquivos e imagens
- integracoes com WhatsApp Meta, Gzappy, PagBank e InfinitePay

## 3. Estrutura de alto nivel

### Codigo-fonte

- `src/app/api`
  - backend HTTP do sistema
- `src/app/app`
  - telas autenticadas do sistema interno
- `src/app`
  - paginas publicas e algumas jornadas fora da area autenticada principal
- `src/components`
  - componentes React reutilizaveis
- `src/context`
  - contextos globais, incluindo autenticacao
- `src/layouts`
  - layouts de `ADMIN`, `ORGANIZER` e `USER`
- `src/lib`
  - utilitarios compartilhados, db, auth, integracoes e servicos de dominio
- `src/services`
  - clientes de consumo da API no frontend
- `src/types`
  - tipos TypeScript do dominio

### Banco e scripts

- `migrations/`
  - scripts SQL de criacao e evolucao do banco
- `scripts/`
  - scripts auxiliares de migracao, manutencao e diagnostico

### Documentacao

- arquivos `.md` na raiz
- documentacao adicional em `docs/`

## 4. Frontend dentro deste projeto

O frontend deste repositorio nao e apenas um painel administrativo simples. Ele contem pelo menos tres areas principais:

### 4.1. Area administrativa

Prefixo principal:

- `src/app/app/admin`

Usada para:

- configuracoes globais
- gestao de pontos
- importacoes
- apoiadores
- usuarios
- quadras, atletas, professores e tabelas administrativas

### 4.2. Area do gestor de arena

Prefixo principal:

- `src/app/app/arena`

E a area mais rica do sistema. Reune:

- agenda e agendamentos
- cards de clientes
- fluxo de caixa
- contas bancarias
- contas a pagar
- dashboard financeiro
- dashboard operacional
- produtos
- professores
- quadras
- competicoes
- historico de atleta
- configuracoes da arena

### 4.3. Area do atleta dentro deste mesmo projeto

Prefixo principal:

- `src/app/app/atleta`

Usada para:

- dashboard do atleta
- perfil
- agenda do atleta
- criacao de agendamento

Observacao:

- existe tambem o projeto externo `appatleta`, que consome a API deste repositorio
- portanto, parte da experiencia do atleta existe aqui e parte existe em frontend externo

## 5. API do projeto

Toda a API fica em:

- `src/app/api`

Ela atende simultaneamente:

- o frontend interno deste proprio projeto
- frontends externos
- integracoes com servicos terceiros
- webhooks recebidos de provedores externos
- tarefas automatizadas, como cron

### 5.1. Caracteristicas da API

- base path padrao: `/api`
- autenticacao principal: `Authorization: Bearer <jwt>`
- algumas rotas sao publicas
- algumas rotas sao internas por papel/permissao
- parte das rotas aceita consumo cross-origin, controlado por CORS

### 5.2. Consumo interno vs externo

O cliente frontend usa por padrao:

- `process.env.NEXT_PUBLIC_API_URL || '/api'`

Ou seja:

- quando o frontend e a API rodam no mesmo deploy, o ideal e usar `/api`
- para frontends externos, pode-se apontar para uma URL absoluta da API

Arquivo relevante:

- [api.ts](file:///c:/carlao-dev/carlaobtonline/src/lib/api.ts)

### 5.3. CORS e consumo externo

O projeto possui suporte explicito a consumo externo da API via CORS.

Arquivo relevante:

- [cors.ts](file:///c:/carlao-dev/carlaobtonline/src/lib/cors.ts)

Pontos importantes:

- `ALLOWED_ORIGINS` permite configurar dominos autorizados
- `localhost` e aceito em desenvolvimento
- o projeto tambem contempla dominos padrao do ecossistema Play Na Quadra
- requisicoes same-origin nao dependem de cabecalhos CORS

## 6. Principais grupos de rotas

A API e grande. Em vez de listar tudo aqui, este documento organiza por familias.

### 6.1. Autenticacao e usuarios

Exemplos:

- `/api/auth/*`
- `/api/user/*`
- `/api/atleta/*`

Responsavel por:

- login
- registro
- perfil
- validacao de senha
- recuperacao de acesso
- busca de usuarios e atletas

### 6.2. Agendamentos

Exemplos:

- `/api/agendamento`
- `/api/agendamento/[id]`
- `/api/public/agendamento/*`
- `/api/bloqueio-agenda/*`

Responsavel por:

- criacao, edicao e cancelamento
- bloqueios de agenda
- calculo de preco
- disponibilidade
- jornadas publicas de reserva

### 6.3. Gestao da arena

Prefixo principal:

- `/api/gestao-arena/*`

Inclui:

- card de cliente
- caixa
- fluxo de caixa
- produtos
- fornecedores
- centros de custo
- dashboards
- historico de atleta
- venda rapida
- conta bancaria
- contas a pagar

### 6.4. Competicoes, partidas e professor

Exemplos:

- `/api/competicao/*`
- `/api/partida/*`
- `/api/professor/*`

### 6.5. Quiosque e atendimento local

Exemplos:

- `/api/kiosk/*`

Uso tipico:

- atendimento presencial
- busca por telefone
- reconhecimento facial
- comanda por numero
- leitura de produtos

### 6.6. Integracoes de mensagens

Exemplos:

- `/api/whatsapp/*`
- `/api/gzappy/*`
- `/api/cron/verificar-notificacoes-agendamento`

Uso tipico:

- envio outbound
- recebimento de webhook
- notificacoes automaticas
- confirmacao de agendamento via WhatsApp

### 6.7. Rotas publicas para consumo externo

Exemplos:

- `/api/public/point/*`
- `/api/public/regiao/*`
- `/api/public/agendamento/*`

Uso tipico:

- listagem publica de arenas
- descoberta por regiao
- horarios disponiveis
- criacao publica de agendamentos

## 7. Papeis e permissoes

O sistema trabalha principalmente com estes papeis:

- `ADMIN`
- `ORGANIZER`
- `USER`

Em linhas gerais:

- `ADMIN`
  - visao ampla da plataforma
- `ORGANIZER`
  - opera uma ou mais arenas
- `USER`
  - experiencia do atleta/usuario final

As permissoes sao aplicadas por rota e por tela.

Arquivos importantes:

- `src/context/AuthContext.tsx`
- `src/layouts/AdminLayout.tsx`
- `src/layouts/ArenaLayout.tsx`
- `src/layouts/AtletaLayout.tsx`

## 8. Integracoes externas

### 8.1. WhatsApp Meta

Uso:

- notificacoes automaticas
- envio de mensagens
- webhook inbound

### 8.2. Gzappy

Uso:

- envio e recebimento de mensagens WhatsApp
- fluxos de confirmacao de agendamento
- webhook inbound

Arquivos importantes:

- `src/lib/gzappyService.ts`
- `src/app/api/gzappy/enviar/route.ts`
- `src/app/api/gzappy/webhook/route.ts`

### 8.3. Pagamentos

Integracoes encontradas:

- PagBank
- InfinitePay
- checkout online proprio

Exemplos de rotas:

- `/api/user/pagamento/pagbank/*`
- `/api/user/pagamento/infinite-pay/*`
- `/api/user/pagamento/online/*`

### 8.4. Google Cloud Storage

Uso:

- upload de imagens
- templates de card
- possivel armazenamento de ativos visuais

### 8.5. Geolocalizacao e regioes

Uso:

- busca de regiao
- arena mais proxima
- suporte a descoberta publica

## 9. Banco de dados e migracoes

O projeto usa PostgreSQL com SQL direto.

Pontos importantes:

- nao ha ORM central como Prisma ou TypeORM
- as regras de negocio costumam estar distribuidas entre rotas, `lib/*` e queries SQL
- migracoes e scripts SQL ficam versionados no repositorio

Locais principais:

- `migrations/`
- `migrations/executadas/`
- `scripts/`

Arquivos relevantes:

- `migrations/create_gzappy_interacao_agendamento.sql`
- `migrations/create_gzappy_webhook_evento.sql`

## 10. Variaveis de ambiente

Documentacao principal:

- [VARIAVEIS_AMBIENTE.md](file:///c:/carlao-dev/carlaobtonline/VARIAVEIS_AMBIENTE.md)

Variaveis mais importantes para entendimento do projeto:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL`
- `ALLOWED_ORIGINS`
- `CRON_SECRET`
- configuracoes Meta WhatsApp
- configuracoes Google Cloud Storage

Observacoes:

- para o frontend web no mesmo deploy, prefira `/api` em vez de URL absoluta
- para consumo externo, configure `ALLOWED_ORIGINS` corretamente
- apos mudar variaveis no Vercel, faca redeploy

## 11. Execucao local

### Scripts principais

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

### Fluxo tipico

1. criar `.env.local`
2. configurar banco e segredos
3. instalar dependencias com `npm install`
4. rodar `npm run dev`

## 12. Deploy

O deploy principal e feito no Vercel.

Ha dois pontos de atencao recorrentes:

- variaveis de ambiente precisam estar corretas no ambiente certo
- um redeploy pode ser necessario para aplicar novas configuracoes ou refletir mudancas de rotas

Documentos relacionados:

- `DEPLOY_VERCEL.md`
- `FORCAR_DEPLOY_VERCEL.md`
- `COMO_CONFIGURAR_CRON_SECRET.md`
- `DESENVOLVIMENTO_LOCAL_API_VERCEL.md`

## 13. Documentacao recomendada por tema

### Entendimento geral

- [VISAO_GERAL_SISTEMA.md](file:///c:/carlao-dev/carlaobtonline/VISAO_GERAL_SISTEMA.md)
- [README.md](file:///c:/carlao-dev/carlaobtonline/README.md)

### API e consumo externo

- [API_DOCUMENTATION.md](file:///c:/carlao-dev/carlaobtonline/API_DOCUMENTATION.md)
- [DOCUMENTACAO_API_FRONTEND_EXTERNO.md](file:///c:/carlao-dev/carlaobtonline/DOCUMENTACAO_API_FRONTEND_EXTERNO.md)
- [API_CONSUMO_EXTERNO.md](file:///c:/carlao-dev/carlaobtonline/API_CONSUMO_EXTERNO.md)
- [ESTRUTURA_API_USER.md](file:///c:/carlao-dev/carlaobtonline/ESTRUTURA_API_USER.md)

### WhatsApp, Gzappy e notificacoes

- [INTEGRACAO_WHATSAPP.md](file:///c:/carlao-dev/carlaobtonline/INTEGRACAO_WHATSAPP.md)
- [IMPLEMENTACAO_NOTIFICACAO_AGENDAMENTO.md](file:///c:/carlao-dev/carlaobtonline/IMPLEMENTACAO_NOTIFICACAO_AGENDAMENTO.md)
- [COMO_CONFIGURAR_CRON_SECRET.md](file:///c:/carlao-dev/carlaobtonline/COMO_CONFIGURAR_CRON_SECRET.md)
- [RESUMO_CONTEXTO_AGENDAMENTOS_GZAPPY.md](file:///c:/carlao-dev/carlaobtonline/RESUMO_CONTEXTO_AGENDAMENTOS_GZAPPY.md)

### CORS e frontends externos

- `VERCEL_CORS_SETUP.md`
- `CORRECAO_CORS_COMPLETA.md`
- `DESENVOLVIMENTO_LOCAL_API_VERCEL.md`

### Migracoes e banco

- `MIGRACAO.md`
- `migrations/README_SCHEMA_ONLY.md`
- `migrations/executadas/README_EXECUTAR_MIGRACOES.md`

## 14. Resumo executivo

Se for preciso explicar o projeto rapidamente:

- este repositorio e o nucleo do sistema Play Na Quadra
- ele concentra frontend interno e API no mesmo projeto Next.js
- a API atende tanto o proprio frontend quanto aplicacoes externas
- o sistema cobre operacao de arena, agendamentos, pagamentos, competicoes, caixa e notificacoes
- o banco e PostgreSQL com SQL direto
- o deploy principal e feito no Vercel

## 15. Como usar este documento em um novo chat

Se precisar retomar o projeto em outro chat, pedir ao assistente para:

1. ler este arquivo
2. ler o arquivo de contexto especifico do tema atual
3. depois abrir os arquivos do modulo que sera alterado

Exemplo:

- "Leia `DOCUMENTACAO_GERAL_PROJETO.md` e `RESUMO_CONTEXTO_AGENDAMENTOS_GZAPPY.md` antes de continuar."
