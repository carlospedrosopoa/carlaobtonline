# Diagnóstico: Erros 404 nas Rotas `/api/user/*`

## Problema
O frontend está recebendo erros 404 ao tentar acessar:
- `/api/user/perfil/atleta`
- `/api/user/arenas/listar`

## Verificação das Rotas

### ✅ Rotas Existem no Código
- ✅ `src/app/api/user/perfil/atleta/route.ts` - Existe e tem CORS configurado
- ✅ `src/app/api/user/arenas/listar/route.ts` - Existe e tem CORS configurado

### ✅ CORS Configurado
Ambas as rotas têm:
- Import de `withCors`
- Aplicação de `withCors` em todas as respostas
- Handler `OPTIONS` para preflight

## Possíveis Causas

### 1. Deploy Não Concluído
O deploy mais recente pode ainda estar em andamento. Verifique:
- Dashboard do Vercel → Projeto `carlaobtonline` → Deployments
- Aguarde o deploy mais recente concluir (status "Ready")

### 2. Cache do Vercel
O Vercel pode estar servindo uma versão antiga do código. Soluções:
- Forçar novo deploy (ver `FORCAR_DEPLOY_VERCEL.md`)
- Aguardar alguns minutos para o cache expirar

### 3. Estrutura de Pastas
Verificar se o Next.js está reconhecendo as rotas:
- As rotas estão em `src/app/api/user/...`
- O Next.js deve reconhecer automaticamente

### 4. Problema de Build
Verificar se há erros no build:
- Dashboard do Vercel → Build Logs
- Verificar se há erros de TypeScript ou compilação

## Soluções

### Solução 1: Forçar Novo Deploy
```bash
cd C:\carlao-dev\carlaobtonline
git commit --allow-empty -m "chore: forçar novo deploy para incluir rotas /api/user/*"
git push
```

### Solução 2: Verificar Build Logs
1. Acesse o Dashboard do Vercel
2. Vá para o projeto `carlaobtonline`
3. Abra o deployment mais recente
4. Verifique os "Build Logs" para erros

### Solução 3: Testar Rotas Diretamente
Teste as rotas diretamente no navegador ou Postman:
- `https://carlaobtonline.vercel.app/api/user/arenas/listar`
- `https://carlaobtonline.vercel.app/api/user/perfil/atleta` (requer autenticação)

### Solução 4: Verificar Variáveis de Ambiente
Verifique se as variáveis de ambiente estão configuradas:
- `ALLOWED_ORIGINS` deve incluir `https://appatleta.vercel.app`
- `DATABASE_URL` deve estar configurada

## Próximos Passos

1. ✅ Verificar se o deploy mais recente foi concluído
2. ✅ Verificar Build Logs para erros
3. ✅ Testar rotas diretamente
4. ✅ Se necessário, forçar novo deploy

## Notas
- As rotas `/api/user/*` foram criadas recentemente
- Se o deploy anterior não incluiu essas rotas, um novo deploy deve resolver
- O frontend está configurado corretamente para usar essas rotas

