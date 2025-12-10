# 🔧 Configuração: Frontend Local com API do Vercel

Este guia explica como configurar o projeto para rodar o frontend localmente (`npm run dev`) e fazer requisições para a API que está deployada no Vercel.

## 📋 Cenário

- **Frontend:** Rodando localmente em `http://localhost:3000` (ou outra porta)
- **API:** Deployada no Vercel (ex: `https://carlaobtonline.vercel.app`)

## 🚀 Passo a Passo

### 1. Configurar a URL da API no Frontend Local

Crie ou edite o arquivo `.env.local` na raiz do projeto:

```env
# URL da API do Vercel (produção)
NEXT_PUBLIC_API_URL=https://carlaobtonline.vercel.app/api

# Database (necessário apenas se você precisar rodar migrações localmente)
DATABASE_URL=postgresql://...
```

**💡 Nota:** Substitua `https://carlaobtonline.vercel.app` pela URL real do seu projeto no Vercel.

### 2. Configurar CORS no Vercel

Como a API está no Vercel (em produção), você precisa configurar o CORS para permitir requisições do seu localhost:

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Selecione seu projeto (`carlaobtonline`)
3. Vá em **Settings** → **Environment Variables**
4. Adicione ou edite a variável:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: `http://localhost:3000,http://localhost:3001` (inclua todas as portas que você usa)
   - **Environment**: Selecione **Preview** e **Development** (opcional: também **Production** se quiser)
5. Se você já tem outros domínios configurados, adicione localhost à lista:
   ```
   http://localhost:3000,http://localhost:3001,https://appatleta.vercel.app
   ```

### 3. Fazer Redeploy da API no Vercel

Após adicionar/atualizar a variável de ambiente:

1. Vá em **Deployments**
2. Clique nos três pontos (⋯) do último deploy
3. Selecione **Redeploy**

Ou faça um novo commit/push para trigger automático.

### 4. Testar Localmente

1. Certifique-se de que o arquivo `.env.local` está configurado com a URL do Vercel
2. Rode o projeto localmente:
   ```bash
   npm run dev
   ```
3. Acesse `http://localhost:3000` no navegador
4. As requisições serão feitas para a API do Vercel

## 🔍 Como Funciona

### Estrutura do Código

O arquivo `src/lib/api.ts` usa a variável `NEXT_PUBLIC_API_URL`:

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
```

- Se `NEXT_PUBLIC_API_URL` estiver definido (ex: `https://carlaobtonline.vercel.app/api`), as requisições vão para lá
- Se não estiver definido, usa `/api` (relativo, assumindo mesma origem)

### CORS

O arquivo `src/lib/cors.ts` no Vercel verifica a variável `ALLOWED_ORIGINS`:

- Se você configurou `http://localhost:3000` na variável, o Vercel permite requisições do seu frontend local
- O header `Access-Control-Allow-Origin` será configurado corretamente

## ✅ Verificação

Após configurar, teste fazendo uma requisição:

```javascript
// No console do navegador (http://localhost:3000)
fetch('https://carlaobtonline.vercel.app/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'teste@exemplo.com',
    password: 'senha123'
  })
})
.then(res => res.json())
.then(data => console.log('Sucesso:', data))
.catch(err => console.error('Erro:', err));
```

Se funcionar sem erros de CORS, está tudo configurado corretamente! 🎉

## 🐛 Troubleshooting

### Erro: "CORS policy blocked"

**Causa:** O Vercel não tem `localhost` configurado na variável `ALLOWED_ORIGINS`

**Solução:**
1. Verifique se adicionou `http://localhost:3000` (ou a porta que você usa) na variável `ALLOWED_ORIGINS` no Vercel
2. Faça redeploy do projeto no Vercel
3. Verifique se está usando a porta correta (o navegador mostra em qual porta o projeto está rodando)

### Erro: "Network error" ou "Failed to fetch"

**Causa:** A URL da API está incorreta ou o projeto não está rodando

**Solução:**
1. Verifique se `NEXT_PUBLIC_API_URL` no `.env.local` está correto
2. Verifique se a URL do Vercel está funcionando (acesse no navegador)
3. Reinicie o servidor local (`npm run dev`)

### A requisição não está indo para o Vercel

**Causa:** A variável `NEXT_PUBLIC_API_URL` não foi carregada

**Solução:**
1. Verifique se o arquivo está nomeado corretamente: `.env.local` (não `.env` ou `.env.development`)
2. Reinicie o servidor após criar/editar o `.env.local`
3. Verifique se não há espaços extras na URL

## 📝 Notas Importantes

### Segurança

- ⚠️ **Nunca** commite o arquivo `.env.local` no Git (já está no `.gitignore`)
- ⚠️ Em produção, use HTTPS para todos os domínios
- ✅ Para desenvolvimento local, usar HTTP com localhost é seguro

### Variáveis de Ambiente

- Variáveis que começam com `NEXT_PUBLIC_` são expostas ao navegador (client-side)
- Variáveis sem `NEXT_PUBLIC_` são apenas server-side
- Após mudar `.env.local`, **sempre reinicie** o servidor (`npm run dev`)

### Ambientes

- **Local:** Frontend local → API do Vercel (este guia)
- **Produção:** Frontend no Vercel → API no Vercel (mesmo projeto, sem CORS necessário)

## 🔗 Referências

- [Next.js - Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

