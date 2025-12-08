# 🔧 Solução: "Redirect is not allowed for a preflight request"

## 🔍 Problema

Erro no console do browser:
```
Access to fetch at 'https://playnaquadra.com.br/api/auth/login' from origin 'https://appatleta.vercel.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
Redirect is not allowed for a preflight request.
```

## 🎯 Causa

A requisição **OPTIONS** (preflight) está sendo **redirecionada** antes de retornar os headers CORS. Isso não é permitido pelo navegador.

### Possíveis causas:

1. **URL HTTP redirecionando para HTTPS**
   - Se a URL configurada é `http://playnaquadra.com.br` mas redireciona para `https://`
   
2. **URL sem trailing slash redirecionando para com trailing slash**
   - Ex: `https://playnaquadra.com.br/api/auth/login` → `https://playnaquadra.com.br/api/auth/login/`

3. **Domínio customizado redirecionando**
   - O domínio `playnaquadra.com.br` pode estar redirecionando para outro domínio

4. **Configuração do Vercel**
   - Pode haver redirecionamentos configurados no Vercel

---

## ✅ Soluções

### Solução 1: Usar URL Direta do Vercel (Recomendado)

Em vez de usar o domínio customizado, use a URL direta do Vercel:

**No frontend (appatleta) → Vercel → Environment Variables:**

```
NEXT_PUBLIC_API_URL=https://carlaobtonline.vercel.app/api
```

**OU** se o projeto tem outro nome:
```
NEXT_PUBLIC_API_URL=https://seu-projeto-api.vercel.app/api
```

**Vantagens:**
- ✅ Sem redirecionamentos
- ✅ Funciona imediatamente
- ✅ Sem configuração de DNS adicional

### Solução 2: Corrigir Domínio Customizado

Se você precisa usar `playnaquadra.com.br`:

1. **Verifique se o domínio está configurado corretamente no Vercel:**
   - Vá em **Settings → Domains**
   - Certifique-se de que `playnaquadra.com.br` está configurado
   - Não deve haver redirecionamentos

2. **Use HTTPS diretamente:**
   - Configure `NEXT_PUBLIC_API_URL` como:
   ```
   https://playnaquadra.com.br/api
   ```
   - **NÃO** use `http://` (será redirecionado)

3. **Verifique redirecionamentos no Vercel:**
   - Vá em **Settings → Domains**
   - Veja se há redirecionamentos configurados
   - Remova qualquer redirecionamento desnecessário

### Solução 3: Configurar Rewrites no Vercel

Se o problema é redirecionamento de `/api/auth/login` para `/auth/login`, configure rewrites:

**Arquivo:** `vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

---

## 🔍 Diagnóstico

### 1. Verificar URL Configurada

No frontend, verifique qual URL está sendo usada:

```javascript
// No console do browser (F12)
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

### 2. Testar Requisição OPTIONS Manualmente

Use curl para testar:

```bash
# Teste com a URL que está falhando
curl -X OPTIONS \
  -H "Origin: https://appatleta.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  https://playnaquadra.com.br/api/auth/login
```

**Se retornar 301/302 (redirect):**
- A URL está redirecionando
- Use a URL final (após o redirect)

**Se retornar 204 com headers CORS:**
- Está funcionando
- O problema pode ser no frontend

### 3. Verificar Logs do Vercel

1. Acesse **Logs → Runtime Logs** no Vercel
2. Tente fazer login
3. Veja se há mensagens de redirecionamento
4. Veja os logs `[CORS DEBUG]` que adicionamos

---

## 🛠️ Correção Aplicada

Corrigi o handler OPTIONS em `/api/auth/login` para usar `withCors` corretamente:

```typescript
// Antes (errado):
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204 });
}

// Depois (correto):
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, request);
}
```

---

## 📝 Checklist

- [ ] Verificou qual URL está configurada em `NEXT_PUBLIC_API_URL`
- [ ] Testou se a URL redireciona (usando curl)
- [ ] Configurou `NEXT_PUBLIC_API_URL` com HTTPS (não HTTP)
- [ ] Usou URL direta do Vercel (sem domínio customizado) para teste
- [ ] Verificou logs do Vercel para ver redirecionamentos
- [ ] Fez redeploy após alterar configurações

---

## 🎯 Recomendação Final

**Para resolver rapidamente:**

1. Use a URL direta do Vercel da API:
   ```
   NEXT_PUBLIC_API_URL=https://carlaobtonline.vercel.app/api
   ```

2. Configure `ALLOWED_ORIGINS` no Vercel da API:
   ```
   https://appatleta.vercel.app,http://localhost:3001
   ```

3. Faça redeploy de ambos os projetos

4. Teste novamente

**Depois que funcionar, você pode configurar o domínio customizado se necessário.**

---

## 🆘 Se Ainda Não Funcionar

1. **Verifique se há middleware redirecionando:**
   - Procure por `middleware.ts` no projeto
   - Verifique se há redirecionamentos configurados

2. **Verifique configurações do domínio:**
   - No provedor de DNS (Registro.br, etc.)
   - Veja se há redirecionamentos configurados

3. **Use a URL do Vercel temporariamente:**
   - Para isolar o problema, use a URL do Vercel
   - Se funcionar, o problema é no domínio customizado

---

**✅ Após corrigir, faça redeploy e teste novamente!**

