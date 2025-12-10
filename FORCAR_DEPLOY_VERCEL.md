# 🚀 Como Forçar Deploy no Vercel

Guia rápido para forçar um novo deploy da API no Vercel.

---

## 📋 Opção 1: Via Dashboard do Vercel (Mais Fácil)

### Passo a Passo:

1. **Acesse o Dashboard do Vercel**
   - Vá para: https://vercel.com/dashboard
   - Faça login se necessário

2. **Encontre seu Projeto**
   - Procure pelo projeto `carlaobtonline` (ou o nome do seu projeto da API)
   - Clique no projeto

3. **Acesse Deployments**
   - No menu lateral ou na página do projeto, clique em **"Deployments"**

4. **Forçar Novo Deploy**
   - Clique nos **três pontos (⋯)** do último deploy
   - Selecione **"Redeploy"**
   - Ou clique no botão **"Redeploy"** se disponível

5. **Aguardar Conclusão**
   - O Vercel iniciará um novo build
   - Aguarde a conclusão (2-5 minutos)
   - Status mudará para **"Ready"** quando concluído

---

## 💻 Opção 2: Via CLI do Vercel (Mais Rápido)

### Instalar Vercel CLI (se não tiver):

```bash
npm install -g vercel
```

### Fazer Login:

```bash
vercel login
```

### Forçar Deploy:

```bash
# Navegar para o diretório da API
cd C:\carlao-dev\carlaobtonline

# Deploy forçado para produção
vercel --prod

# Ou deploy para preview
vercel
```

---

## 🔄 Opção 3: Via Git (Deploy Automático)

Se você quiser forçar um deploy através do Git:

```bash
# Navegar para o diretório da API
cd C:\carlao-dev\carlaobtonline

# Fazer uma pequena alteração (ou apenas commit vazio)
git commit --allow-empty -m "chore: forçar deploy"

# Push para GitHub
git push origin main

# O Vercel detectará automaticamente e fará deploy
```

---

## ⚡ Comando Rápido (Tudo em Um)

Se você já tem a Vercel CLI instalada e está logado:

```bash
cd C:\carlao-dev\carlaobtonline && vercel --prod
```

---

## 🛠️ Troubleshooting

### Erro: "Command not found: vercel"

**Solução:**
```bash
npm install -g vercel
```

### Erro: "Not logged in"

**Solução:**
```bash
vercel login
```

### Erro: "Project not found"

**Solução:**
1. Certifique-se de estar no diretório correto (`carlaobtonline`)
2. Ou especifique o projeto:
   ```bash
   vercel --prod --cwd C:\carlao-dev\carlaobtonline
   ```

### Deploy Falhou

**Verificar:**
1. Logs do build no dashboard do Vercel
2. Variáveis de ambiente configuradas
3. Dependências no `package.json`
4. Erros de TypeScript: `npm run build` localmente

---

## 📝 Checklist Rápido

- [ ] Estou no diretório correto (`carlaobtonline`)
- [ ] Vercel CLI instalada (ou uso o dashboard)
- [ ] Logado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Build local funciona (`npm run build`)

---

## 🎯 Recomendação

**Para uso rápido:** Use o Dashboard do Vercel (Opção 1)  
**Para automação:** Use a CLI do Vercel (Opção 2)  
**Para deploy automático:** Use Git push (Opção 3)

---

**✅ Pronto! Seu deploy será forçado!**

