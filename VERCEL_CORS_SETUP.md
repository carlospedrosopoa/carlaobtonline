# 🔧 Configuração de CORS para Produção no Vercel

Este guia explica como configurar o CORS para permitir que frontends externos consumam a API em produção no Vercel.

## 📋 Pré-requisitos

- Projeto já deployado no Vercel
- Acesso ao dashboard do Vercel
- Domínios dos frontends externos que precisam acessar a API

## 🚀 Passo a Passo

### 1. Acessar as Configurações do Projeto no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Selecione seu projeto (`carlaobtonline`)
3. Vá em **Settings** → **Environment Variables**

### 2. Adicionar a Variável de Ambiente `ALLOWED_ORIGINS`

1. Clique em **Add New**
2. Configure:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: Lista de domínios separados por vírgula (sem espaços extras)
   - **Environment**: Selecione **Production**, **Preview** e **Development** (ou apenas Production se preferir)

#### Exemplo de Valor:

```
https://meu-frontend.vercel.app,https://outro-frontend.com,https://app.exemplo.com.br
```

**⚠️ Importante:**
- Use **HTTPS** em produção (não use HTTP)
- Inclua o protocolo completo (`https://`)
- Não inclua barra final (`/`)
- Separe múltiplos domínios por vírgula
- Não adicione espaços entre vírgulas

### 3. Exemplos de Configuração

#### Um único frontend:
```
https://appatleta.vercel.app
```

#### Múltiplos frontends:
```
https://appatleta.vercel.app,https://frontend2.com,https://app.exemplo.com.br
```

#### Frontend em subdomínio:
```
https://app.exemplo.com.br,https://admin.exemplo.com.br
```

#### Permitir desenvolvimento local (frontend local acessando API do Vercel):
```
http://localhost:3000,http://localhost:3001,https://appatleta.vercel.app
```

**💡 Dica:** Se você quer testar localmente (`npm run dev`) fazendo requisições para a API do Vercel, adicione `http://localhost:3000` (ou a porta que você usa) na variável `ALLOWED_ORIGINS`.

### 4. Fazer Redeploy

Após adicionar a variável de ambiente:

1. Vá em **Deployments**
2. Clique nos três pontos (⋯) do último deploy
3. Selecione **Redeploy**
4. Ou faça um novo commit/push para trigger automático

### 5. Verificar se Está Funcionando

Após o redeploy, teste fazendo uma requisição do frontend externo:

```javascript
// Exemplo de requisição do frontend externo
fetch('https://seu-projeto.vercel.app/api/auth/login', {
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
.then(data => console.log(data))
.catch(err => console.error('Erro CORS:', err));
```

Se funcionar, você verá os dados. Se houver erro de CORS, verifique:
- ✅ Se o domínio está correto na variável `ALLOWED_ORIGINS`
- ✅ Se está usando HTTPS
- ✅ Se fez o redeploy após adicionar a variável

## 🔍 Como Funciona

O código em `src/lib/cors.ts` verifica:

1. **Quando a API roda localmente** (`npm run dev`): Permite automaticamente `localhost:3000`, `localhost:3001`, `localhost:5173`
2. **Quando a API está no Vercel** (produção): Usa a variável `ALLOWED_ORIGINS` para determinar quais domínios são permitidos
3. **Sem variável configurada no Vercel**: Nenhum domínio externo é permitido (apenas requisições do mesmo domínio)

**⚠️ Importante:** Quando a API está no Vercel, ela roda em produção, então mesmo que você esteja testando localmente (`npm run dev`), o Vercel precisa ter `localhost` configurado na variável `ALLOWED_ORIGINS` para permitir que seu frontend local acesse a API do Vercel.

## 📝 Notas Importantes

### Segurança

- ⚠️ **Nunca** use `*` (wildcard) em produção - isso permite qualquer domínio
- ✅ Sempre liste explicitamente os domínios permitidos
- ✅ Use HTTPS em produção
- ✅ Revise periodicamente a lista de domínios permitidos

### Desenvolvimento vs Produção

- **Desenvolvimento**: Funciona automaticamente com localhost
- **Produção**: Requer configuração explícita via `ALLOWED_ORIGINS`

### Ambientes do Vercel

Você pode configurar valores diferentes para:
- **Production**: Domínios de produção
- **Preview**: Domínios de preview/staging
- **Development**: Geralmente não necessário (usa localhost)

## 🐛 Troubleshooting

### Erro: "CORS policy blocked"

**Causa**: O domínio do frontend não está na lista `ALLOWED_ORIGINS`

**Solução**: 
1. Verifique o domínio exato que está fazendo a requisição
2. Adicione-o à variável `ALLOWED_ORIGINS` no Vercel
3. Faça redeploy

### Erro: "Preflight request failed"

**Causa**: Requisição OPTIONS não está sendo tratada corretamente

**Solução**: 
- Verifique se o arquivo `src/proxy.ts` está configurado corretamente
- Verifique se todas as rotas estão usando `withCors()`

### Variável não está funcionando

**Causa**: Variável não foi aplicada ao ambiente correto ou não houve redeploy

**Solução**:
1. Verifique se selecionou o ambiente correto (Production)
2. Faça um redeploy manual
3. Verifique os logs do Vercel para confirmar que a variável está sendo lida

## 📚 Referências

- [Documentação do Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)


