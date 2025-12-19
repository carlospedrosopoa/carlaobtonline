# Como Configurar CRON_SECRET na Vercel

## Passo a Passo

### 1. Acessar o Dashboard da Vercel

1. Acesse https://vercel.com
2. Faça login na sua conta
3. Selecione o projeto `carlaobtonline`

### 2. Ir para Configurações de Variáveis de Ambiente

1. No menu do projeto, clique em **Settings** (Configurações)
2. No menu lateral, clique em **Environment Variables** (Variáveis de Ambiente)

### 3. Adicionar a Variável CRON_SECRET

1. Clique no botão **Add New** (Adicionar Nova)
2. Preencha os campos:
   - **Name**: `CRON_SECRET`
   - **Value**: Gere uma chave secreta forte (veja abaixo como gerar)
   - **Environment**: Selecione todas as opções:
     - ☑️ Production
     - ☑️ Preview
     - ☑️ Development
3. Clique em **Save** (Salvar)

### 4. Gerar uma Chave Secreta Segura

Você pode gerar uma chave secreta de várias formas:

#### Opção 1: Usando Node.js (no terminal)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Opção 2: Usando OpenSSL (no terminal)
```bash
openssl rand -hex 32
```

#### Opção 3: Usando PowerShell (Windows)
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

#### Opção 4: Online (menos seguro, mas funciona)
- Acesse https://randomkeygen.com/
- Use uma "CodeIgniter Encryption Keys" de 64 caracteres

### 5. Exemplo de Valor

Uma chave secreta deve ser algo como:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Importante**: 
- Use uma chave diferente para cada ambiente (Production, Preview, Development) se quiser mais segurança
- Ou use a mesma chave para todos se preferir simplicidade
- Guarde essa chave em local seguro (não compartilhe publicamente)

### 6. Verificar se Funcionou

Após adicionar a variável:

1. A Vercel vai fazer um novo deploy automaticamente
2. Ou você pode fazer um deploy manual clicando em **Deployments** → **Redeploy**

### 7. Testar a Rota de Cron

Após o deploy, você pode testar manualmente:

```bash
# Substitua SUA_CHAVE_SECRETA pela chave que você configurou
curl -X GET \
  -H "Authorization: Bearer SUA_CHAVE_SECRETA" \
  https://carlaobtonline.vercel.app/api/cron/verificar-notificacoes-agendamento
```

Se funcionar, você verá uma resposta JSON com estatísticas.

### 8. Verificar Logs

Para ver se o cron está rodando:

1. No dashboard da Vercel, vá em **Deployments**
2. Clique no deployment mais recente
3. Vá em **Functions** → `api/cron/verificar-notificacoes-agendamento`
4. Veja os logs de execução

### 9. Configurar o Cron no Dashboard (Opcional)

A Vercel também permite configurar crons via interface:

1. Vá em **Settings** → **Cron Jobs**
2. Você verá o cron configurado no `vercel.json`
3. Pode verificar o status e histórico de execuções

## Troubleshooting

### Cron não está rodando?

1. Verifique se o `vercel.json` está correto
2. Verifique se a variável `CRON_SECRET` está configurada
3. Verifique os logs na Vercel
4. Teste manualmente a rota com a chave secreta

### Erro 401 Unauthorized?

- Verifique se a chave `CRON_SECRET` está configurada corretamente
- Verifique se está usando a mesma chave no header `Authorization: Bearer {CRON_SECRET}`

### Como verificar se a variável está configurada?

No código, você pode adicionar temporariamente:
```typescript
console.log('CRON_SECRET configurado:', !!process.env.CRON_SECRET);
```

Mas **nunca** logue o valor da chave em produção!

## Segurança

⚠️ **Importante**:
- Nunca commite a chave secreta no código
- Use variáveis de ambiente sempre
- A chave deve ser longa e aleatória (mínimo 32 caracteres)
- Não compartilhe a chave publicamente

