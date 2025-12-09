# ✅ Correção CORS - appatleta.vercel.app

## 🔧 O que foi corrigido

### 1. Variável de Ambiente

A variável `ALLOWED_ORIGINS` no arquivo `.env.local` foi atualizada para incluir o domínio do frontend externo:

**Antes:**
```
ALLOWED_ORIGINS=http://localhost:3001
```

**Depois:**
```
ALLOWED_ORIGINS=http://localhost:3001,https://appatleta.vercel.app
```

### 2. Rotas da API sem CORS

Foram adicionados os headers CORS nas seguintes rotas que estavam faltando:

- ✅ `/api/bloqueio-agenda` - GET, POST, OPTIONS
- ✅ `/api/bloqueio-agenda/[id]` - GET, PUT, DELETE, OPTIONS

Todas as respostas dessas rotas agora usam `withCors()` para permitir requisições cross-origin.

## ⚠️ IMPORTANTE: Configurar no Vercel

Para que o CORS funcione em **produção**, você **DEVE** configurar a mesma variável no Vercel:

### Passos:

1. Acesse o [Dashboard do Vercel](https://vercel.com)
2. Selecione o projeto **`carlaobtonline`**
3. Vá em **Settings** → **Environment Variables**
4. Adicione ou edite a variável:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: `http://localhost:3001,https://appatleta.vercel.app`
   - **Environment**: Selecione **Production** (e Preview se necessário)
5. **Faça um redeploy**:
   - Vá em **Deployments**
   - Clique nos três pontos (⋯) do último deploy
   - Selecione **Redeploy**

### ⚡ Redeploy Rápido (via terminal)

Se preferir, você pode fazer um commit vazio para forçar o redeploy:

```bash
git commit --allow-empty -m "chore: atualizar CORS para appatleta.vercel.app"
git push
```

## 🧪 Como testar

Após configurar no Vercel e fazer o redeploy:

1. Acesse `https://appatleta.vercel.app/app/atleta/agendamentos`
2. Abra o Console do navegador (F12)
3. Verifique se não há mais erros de CORS
4. As requisições para as seguintes APIs devem funcionar:
   - `https://carlaobtonline.vercel.app/api/quadra`
   - `https://carlaobtonline.vercel.app/api/bloqueio-agenda`

## 📋 Verificação

Se ainda houver erro de CORS após o redeploy:

1. ✅ Verifique se a variável `ALLOWED_ORIGINS` está configurada no Vercel
2. ✅ Verifique se o valor está exatamente: `http://localhost:3001,https://appatleta.vercel.app`
3. ✅ Verifique se selecionou o ambiente **Production**
4. ✅ Verifique se fez o redeploy após adicionar a variável
5. ✅ Verifique os logs do Vercel para ver se há mensagens `[CORS DEBUG]`

## 📚 Documentação Completa

Para mais detalhes sobre configuração de CORS, consulte:
- `VERCEL_CORS_SETUP.md` - Guia completo de configuração de CORS

