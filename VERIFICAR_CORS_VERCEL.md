# 🔍 Como Verificar e Corrigir CORS no Vercel

## ❌ Erro Atual

```
Access to fetch at 'https://carlaobtonline.vercel.app/api/auth/login' 
from origin 'https://appatleta.vercel.app' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ Solução: Configurar ALLOWED_ORIGINS no Vercel

### Passo 1: Verificar Variável de Ambiente

1. Acesse [Vercel Dashboard](https://vercel.com)
2. Selecione o projeto **`carlaobtonline`**
3. Vá em **Settings** → **Environment Variables**
4. Procure por `ALLOWED_ORIGINS`

### Passo 2: Adicionar/Editar ALLOWED_ORIGINS

**Se a variável NÃO existe:**
- Clique em **Add New**
- **Name**: `ALLOWED_ORIGINS`
- **Value**: `https://appatleta.vercel.app,http://localhost:3001`
- **Environment**: Selecione **Production**, **Preview** e **Development**
- Clique em **Save**

**Se a variável JÁ existe:**
- Clique em **Edit** (ícone de lápis)
- Verifique se o valor inclui `https://appatleta.vercel.app`
- Se não incluir, adicione: `https://appatleta.vercel.app,http://localhost:3001`
- **IMPORTANTE**: Mantenha as origens separadas por vírgula, SEM espaços extras
- Clique em **Save**

### Passo 3: Fazer Redeploy

**Opção A: Via Dashboard**
1. Vá em **Deployments**
2. Clique nos três pontos (⋯) do último deploy
3. Selecione **Redeploy**
4. Aguarde o deploy terminar (1-2 minutos)

**Opção B: Via Terminal (commit vazio)**
```bash
cd C:\carlao-dev\carlaobtonline
git commit --allow-empty -m "chore: forçar redeploy para aplicar CORS"
git push
```

## 🔍 Verificar se Funcionou

### 1. Verificar Logs do Vercel

Após o redeploy, verifique os logs:

1. Vá em **Deployments** → Clique no último deploy
2. Vá em **Functions** → Clique em uma função (ex: `/api/auth/login`)
3. Procure por logs `[CORS DEBUG]`:
   - Deve mostrar: `Origin recebida: https://appatleta.vercel.app`
   - Deve mostrar: `Origem permitida? true`
   - Deve mostrar: `✅ Origem permitida - adicionando headers CORS`

### 2. Testar no Navegador

1. Acesse `https://appatleta.vercel.app/login`
2. Abra o Console do navegador (F12)
3. Tente fazer login
4. **NÃO deve** aparecer erro de CORS
5. Se aparecer erro 401, é problema de autenticação, não CORS

## ⚠️ Problemas Comuns

### Problema 1: Variável não está sendo aplicada

**Sintoma**: Logs mostram `envOrigins existe? false`

**Solução**:
- Verifique se selecionou o ambiente correto (Production)
- Faça um redeploy após adicionar/editar a variável
- Verifique se não há espaços extras no valor

### Problema 2: Valor incorreto

**Sintoma**: Logs mostram `Origem permitida? false` mesmo com a variável configurada

**Solução**:
- Verifique se o valor está exatamente: `https://appatleta.vercel.app,http://localhost:3001`
- **NÃO** use espaços após vírgulas
- **NÃO** use aspas no valor
- **NÃO** use `http://` em vez de `https://` para produção

### Problema 3: Redeploy não aplicou mudanças

**Solução**:
- Aguarde 2-3 minutos após o redeploy
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Teste em modo anônimo/privado
- Verifique se o deploy realmente terminou (status "Ready")

## 📋 Checklist Final

- [ ] Variável `ALLOWED_ORIGINS` existe no Vercel
- [ ] Valor inclui `https://appatleta.vercel.app`
- [ ] Ambiente selecionado: **Production** (e Preview se necessário)
- [ ] Redeploy foi feito após adicionar/editar a variável
- [ ] Logs do Vercel mostram `✅ Origem permitida`
- [ ] Teste no navegador não mostra erro de CORS

## 🆘 Ainda com Problemas?

Se após seguir todos os passos ainda houver erro de CORS:

1. **Verifique os logs do Vercel** para ver o que está acontecendo
2. **Copie os logs `[CORS DEBUG]`** e compartilhe
3. **Verifique se a rota `/api/auth/login` tem `withCors` aplicado**
4. **Verifique se a rota tem handler `OPTIONS`**



