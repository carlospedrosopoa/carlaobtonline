# Troubleshooting: Template do Card não carrega em Produção (Vercel)

## Possíveis Causas

### 1. Variável de Ambiente não Configurada no Vercel
**Sintoma:** Template padrão não é encontrado, card usa fundo programático.

**Solução:**
1. Acesse o dashboard do Vercel: https://vercel.com/dashboard
2. Vá em **Settings** → **Environment Variables**
3. Adicione a variável:
   - **Key:** `CARD_DEFAULT_TEMPLATE_URL`
   - **Value:** `https://storage.googleapis.com/seu-bucket/templates/card_base.png`
   - **Environment:** Production (e Preview se necessário)
4. Faça um novo deploy após adicionar a variável

### 2. Arquivo não está Público no GCS
**Sintoma:** Erro 403 Forbidden ao tentar carregar o template.

**Solução:**
1. Acesse o Google Cloud Console
2. Vá em **Cloud Storage** → Seu bucket
3. Navegue até o arquivo do template
4. Clique nos três pontos → **Edit permissions**
5. Adicione uma permissão:
   - **Entity:** `allUsers`
   - **Role:** `Storage Object Viewer`
6. Salve e teste novamente

**Alternativa (via gsutil):**
```bash
gsutil acl ch -u AllUsers:R gs://seu-bucket/templates/card_base.png
```

### 3. URL Incorreta ou Arquivo não Existe
**Sintoma:** Erro 404 Not Found.

**Solução:**
1. Verifique se a URL está correta no Vercel
2. Confirme que o arquivo existe no bucket
3. Use a URL pública: `https://storage.googleapis.com/bucket/path/to/file.png`
4. Evite usar `storage.cloud.google.com` (requer autenticação)

### 4. Problemas com Signed URLs
**Sintoma:** Template não carrega mesmo com Signed URL.

**Possíveis causas:**
- Service Account sem permissões adequadas
- Credenciais não configuradas corretamente no Vercel
- Timeout na geração da Signed URL

**Solução:**
- Verifique se o Service Account tem a role `Storage Object Viewer`
- Confirme que as variáveis `GOOGLE_CLOUD_PROJECT_ID` e `GOOGLE_CLOUD_STORAGE_BUCKET` estão configuradas
- Torne o arquivo público (solução mais simples)

### 5. Timeout na Requisição
**Sintoma:** Timeout ao carregar template (15 segundos).

**Solução:**
- Verifique o tamanho do arquivo (deve ser < 5MB)
- Otimize a imagem do template
- Verifique a conectividade do servidor Vercel com o GCS

## Endpoint de Diagnóstico

Foi criado um endpoint de diagnóstico para ajudar a identificar o problema:

**GET** `/api/card/debug`

**Requisitos:**
- Autenticação JWT obrigatória
- Apenas usuários com role `ADMIN` podem acessar

**Resposta:**
```json
{
  "variavelAmbienteDefinida": true,
  "templatePadrao": "https://storage.googleapis.com/...",
  "urlNormalizada": "https://storage.googleapis.com/...",
  "statusHttp": 200,
  "acessivel": true,
  "gcsConfigurado": {
    "projectId": true,
    "bucket": true,
    "projectIdValue": "seu-project-id",
    "bucketValue": "seu-bucket"
  }
}
```

**Como usar:**
1. Faça login como ADMIN
2. Acesse: `https://sua-api.vercel.app/api/card/debug`
3. Analise a resposta para identificar o problema

## Checklist de Verificação

- [ ] Variável `CARD_DEFAULT_TEMPLATE_URL` configurada no Vercel (Production)
- [ ] Arquivo do template existe no bucket GCS
- [ ] Arquivo está público (permissão `allUsers` com role `Storage Object Viewer`)
- [ ] URL usa `storage.googleapis.com` (não `storage.cloud.google.com`)
- [ ] Variáveis `GOOGLE_CLOUD_PROJECT_ID` e `GOOGLE_CLOUD_STORAGE_BUCKET` configuradas
- [ ] Service Account tem permissões adequadas (se usar Signed URLs)
- [ ] Arquivo do template não é muito grande (< 5MB recomendado)

## Logs para Verificar

No Vercel, verifique os logs da função que gera o card. Procure por:

- `[Card] Template padrão:` - Deve mostrar a URL do template
- `[generateCard] Tentando carregar template da URL:` - Mostra qual URL está sendo usada
- `[generateCard] ✅ Template carregado da URL com sucesso` - Confirma sucesso
- `[generateCard] ⚠️ Template não foi carregado` - Indica falha
- `[generateCard] ❌ Erro ao carregar template` - Mostra o erro específico

## Solução Rápida

Se o template não está carregando, a solução mais rápida é:

1. **Tornar o arquivo público no GCS:**
   ```bash
   gsutil acl ch -u AllUsers:R gs://seu-bucket/templates/card_base.png
   ```

2. **Verificar a URL no Vercel:**
   - Use: `https://storage.googleapis.com/seu-bucket/templates/card_base.png`
   - Não use: `https://storage.cloud.google.com/...`

3. **Fazer um novo deploy** após configurar a variável de ambiente

4. **Testar o endpoint de diagnóstico:**
   ```
   GET /api/card/debug
   Authorization: Bearer <seu-token-admin>
   ```

