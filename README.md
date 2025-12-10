# App Atleta

Aplicação frontend focada na experiência do usuário final (USER) para agendamento de quadras e gestão de partidas.

## 🎯 Objetivo

Este projeto é uma aplicação separada do projeto principal (`carlaobtonline`), focada exclusivamente na experiência do usuário final. O projeto principal (`carlaobtonline`) contém a API e a interface de gestão para ADMIN e ORGANIZER.

## 🚀 Configuração

### Variáveis de Ambiente

**📝 Template disponível:** Veja `ENV_EXAMPLE.txt` para um exemplo completo.

Crie um arquivo `.env.local` na raiz do projeto:

```env
# URL da API (projeto principal)
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Para produção, use a URL do projeto principal:
# NEXT_PUBLIC_API_URL=https://seu-dominio.com/api

# Database (se necessário para desenvolvimento local)
DATABASE_URL=postgresql://...

# CORS - Domínios permitidos para consumir a API (separados por vírgula)
# Em desenvolvimento, localhost é permitido automaticamente
# Em produção, configure no Vercel: Settings → Environment Variables
# Exemplo: ALLOWED_ORIGINS=https://frontend1.vercel.app,https://frontend2.com
# Para permitir https://appatleta.vercel.app:
# ALLOWED_ORIGINS=https://appatleta.vercel.app

# Google Cloud Storage (opcional - para upload de imagens)
# Em produção (Vercel), apenas estas duas variáveis são necessárias:
# GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
# GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
# A autenticação é automática via Application Default Credentials (ADC)
# 
# Para desenvolvimento local (opcional - apenas se não tiver ADC configurado):
# GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

#### 🔧 Configuração de CORS para Produção (Vercel)

Para permitir que frontends externos consumam a API em produção:

1. Acesse o dashboard do Vercel → Seu Projeto → **Settings** → **Environment Variables**
2. Adicione a variável:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: Domínios separados por vírgula (ex: `https://frontend1.vercel.app,https://frontend2.com`)
   - **Environment**: Production (e Preview se necessário)
3. Faça um **Redeploy** do projeto

📖 **Guias:**
- `VERCEL_CORS_SETUP.md` - Configuração de CORS para produção
- `DESENVOLVIMENTO_LOCAL_API_VERCEL.md` - Como usar frontend local com API do Vercel

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3001` (ou outra porta disponível).

## 📁 Estrutura

- `/src/app` - Rotas e páginas da aplicação
- `/src/components` - Componentes React reutilizáveis
- `/src/lib` - Utilitários e configurações (API client, auth, etc.)
- `/src/services` - Serviços para comunicação com a API
- `/src/types` - Definições TypeScript

## 🔐 Autenticação

A autenticação é feita via JWT através da API do projeto principal. O token é armazenado no `localStorage` e enviado em todas as requisições.

## 🎨 Funcionalidades

- **Dashboard**: Visualização de quadras disponíveis e partidas
- **Agendamentos**: Listagem, criação e edição de agendamentos
- **Agenda Semanal**: Visualização semanal de agendamentos
- **Perfil**: Gerenciamento do perfil do atleta

## 📝 Notas

- Este projeto consome a API do projeto principal (`carlaobtonline`)
- Todas as rotas de API estão no projeto principal
- Este projeto contém apenas o frontend para usuários finais

## 📚 Documentação da API

Para frontends externos que precisam consumir a API:

- **Documentação Completa**: Veja `API_DOCUMENTATION.md` para todas as rotas disponíveis, exemplos de uso, autenticação e tratamento de erros.
- **Configuração CORS**: Veja `VERCEL_CORS_SETUP.md` para configurar CORS em produção no Vercel.
- **Upload de Imagens**: Veja `GOOGLE_CLOUD_STORAGE_SETUP.md` para configurar upload de imagens com Google Cloud Storage.
