# 🔧 Solução: CORS no Vercel - Frontend não consegue fazer login

## 🔍 Diagnóstico

Se o localhost funciona mas o frontend no Vercel não, o problema geralmente é:

1. **URL incorreta** no `ALLOWED_ORIGINS`
2. **Trailing slash** ou diferença na URL
3. **Espaços** na configuração
4. **URL não corresponde exatamente** ao que o browser envia

---

## ✅ Solução Passo a Passo

### 1. Verificar a URL Exata do Frontend

Acesse o frontend no Vercel e verifique a URL exata:
- Exemplo: `https://appatleta.vercel.app` (sem trailing slash)
- Ou: `https://appatleta-xyz123.vercel.app` (URL de preview)

### 2. Configurar ALLOWED_ORIGINS Corretamente

No Vercel do projeto **carlaobtonline** (API), configure:

**Settings → Environment Variables → ALLOWED_ORIGINS**

**Valor correto:**
```
https://appatleta.vercel.app,http://localhost:3001
```

**⚠️ IMPORTANTE:**
- ✅ Sem espaços após as vírgulas
- ✅ Sem trailing slash (`/`) no final
- ✅ Protocolo completo (`https://` ou `http://`)
- ✅ URLs separadas por vírgula simples

**❌ ERRADO:**
```
https://appatleta.vercel.app/, http://localhost:3001  (trailing slash e espaços)
appatleta.vercel.app,localhost:3001  (sem protocolo)
```

**✅ CORRETO:**
```
https://appatleta.vercel.app,http://localhost:3001
```

### 3. Verificar Múltiplas URLs do Vercel

O Vercel pode gerar múltiplas URLs:
- **Production**: `https://appatleta.vercel.app`
- **Preview**: `https://appatleta-git-branch-xyz.vercel.app`

Se você usa preview branches, adicione todas:

```
https://appatleta.vercel.app,https://appatleta-*.vercel.app,http://localhost:3001
```

**OU** adicione URLs específicas:

```
https://appatleta.vercel.app,https://appatleta-git-main-xyz.vercel.app,http://localhost:3001
```

### 4. Verificar a Origem que o Browser Envia

Para debugar, adicione logs temporários no backend:

**Arquivo:** `src/lib/cors.ts`

Adicione antes da linha 36:
```typescript
console.log('[CORS] Origin recebida:', origin);
console.log('[CORS] Origens permitidas:', allowedOrigins);
console.log('[CORS] Está permitida?', allowedOrigins.includes(origin));
```

Isso mostrará nos logs do Vercel qual origem está sendo enviada.

### 5. Redeploy Após Alterar Variável

**⚠️ CRÍTICO:** Após alterar `ALLOWED_ORIGINS` no Vercel:

1. Vá em **Deployments**
2. Clique nos **três pontos (⋯)** do último deploy
3. Selecione **Redeploy**
4. Aguarde o redeploy completar

**OU** faça um commit vazio para forçar redeploy:
```bash
cd C:\carlao-dev\carlaobtonline
git commit --allow-empty -m "chore: forçar redeploy após alterar ALLOWED_ORIGINS"
git push origin main
```

---

## 🔍 Verificação no Browser

### Console do Browser (F12)

1. Abra o frontend no Vercel
2. Abra o Console (F12)
3. Tente fazer login
4. Veja o erro de CORS completo

**Erro típico:**
```
Access to fetch at 'https://carlaobtonline.vercel.app/api/user/auth/login' 
from origin 'https://appatleta.vercel.app' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Isso confirma que a origem `https://appatleta.vercel.app` não está sendo permitida.

### Network Tab (F12 → Network)

1. Abra o Network tab
2. Tente fazer login
3. Clique na requisição que falhou
4. Veja o header **Request Headers → Origin**
5. Compare com o que está em `ALLOWED_ORIGINS`

---

## 🛠️ Solução Rápida (Teste)

Para testar rapidamente, você pode temporariamente permitir todas as origens:

**No Vercel → Environment Variables → ALLOWED_ORIGINS:**
```
*
```

**⚠️ ATENÇÃO:** Isso permite qualquer origem. Use apenas para teste e depois configure corretamente.

---

## 📝 Checklist de Verificação

- [ ] URL no `ALLOWED_ORIGINS` está **exatamente** igual à URL do frontend
- [ ] Sem trailing slash (`/`) no final
- [ ] Sem espaços antes/depois das vírgulas
- [ ] Protocolo completo (`https://` ou `http://`)
- [ ] Redeploy feito após alterar a variável
- [ ] Verificou os logs do Vercel para ver qual origem está sendo recebida
- [ ] Testou no console do browser para ver o erro completo

---

## 🎯 Exemplo de Configuração Final

**Para produção:**
```
https://appatleta.vercel.app,http://localhost:3001
```

**Se tiver domínio customizado:**
```
https://appatleta.seudominio.com,https://appatleta.vercel.app,http://localhost:3001
```

**Para incluir preview branches:**
```
https://appatleta.vercel.app,https://appatleta-*.vercel.app,http://localhost:3001
```

---

## 🆘 Se Ainda Não Funcionar

1. **Verifique os logs do Vercel:**
   - Vá em **Logs** no projeto carlaobtonline
   - Veja se há mensagens de CORS
   - Verifique qual origem está sendo recebida

2. **Teste com curl:**
   ```bash
   curl -H "Origin: https://appatleta.vercel.app" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://carlaobtonline.vercel.app/api/user/auth/login
   ```
   
   Deve retornar headers CORS se estiver configurado corretamente.

3. **Verifique se a rota usa `withCors`:**
   - Confirme que a rota `/api/user/auth/login` está usando `withCors`
   - Veja: `src/app/api/user/auth/login/route.ts`

---

**✅ Após corrigir, faça redeploy e teste novamente!**

