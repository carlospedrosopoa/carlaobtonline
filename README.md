# App Unificado - Next.js

Sistema completo com frontend e backend unificados em Next.js.

## 🚀 Deploy no Vercel

1. Importe este repositório no Vercel
2. Configure a variável de ambiente:
   - `DATABASE_URL`: URL de conexão do PostgreSQL

## 📦 Instalação Local

```bash
npm install
npm run dev
```

## 🔧 Tecnologias

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Tailwind CSS

## 📝 Variáveis de Ambiente

Crie um arquivo `.env.local`:

```
DATABASE_URL=postgresql://user:password@host:port/database
```

## 🏗️ Estrutura

- `/src/app` - Páginas e rotas da API
- `/src/components` - Componentes React
- `/src/lib` - Utilitários e serviços
- `/src/context` - Context API
- `/src/types` - Tipos TypeScript
