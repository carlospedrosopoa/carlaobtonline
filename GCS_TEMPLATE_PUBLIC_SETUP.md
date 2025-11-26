# Como Tornar Template Público no Google Cloud Storage

## 🚨 Problema: Erro 403 (Forbidden)

Se você está recebendo erro `403` ao tentar carregar o template, significa que o arquivo não está público no Google Cloud Storage.

## ✅ Solução 1: Tornar o Arquivo Público (Recomendado)

### Via Console do Google Cloud

1. **Acesse o Google Cloud Console**
   - Vá para: https://console.cloud.google.com/storage/browser

2. **Navegue até seu bucket**
   - Selecione o bucket: `my-image-database-bucket`

3. **Encontre o arquivo do template**
   - Navegue até: `templates/card_base.png`

4. **Tornar público**
   - Clique no arquivo `card_base.png`
   - Na aba **Permissions** (Permissões)
   - Clique em **Add Principal** (Adicionar Principal)
   - Em **New principals**, digite: `allUsers`
   - Em **Role**, selecione: **Storage Object Viewer**
   - Clique em **Save**

5. **Verificar**
   - A URL `https://storage.googleapis.com/my-image-database-bucket/templates/card_base.png` deve estar acessível publicamente

### Via gsutil (Linha de Comando)

```bash
# Tornar arquivo específico público
gsutil acl ch -u AllUsers:R gs://my-image-database-bucket/templates/card_base.png

# Ou tornar toda a pasta templates pública
gsutil -m acl ch -r -u AllUsers:R gs://my-image-database-bucket/templates/
```

### Via API/Node.js

```typescript
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'seu-project-id',
});

const bucket = storage.bucket('my-image-database-bucket');
const file = bucket.file('templates/card_base.png');

// Tornar público
await file.makePublic();
```

## ✅ Solução 2: Usar Signed URLs (Já Implementado)

O código já suporta Signed URLs automaticamente. Se o arquivo não estiver público e você tiver credenciais configuradas, o sistema tentará gerar uma Signed URL automaticamente.

**Vantagens:**
- Não precisa tornar o arquivo público
- Mais seguro (URL expira após 1 hora)

**Desvantagens:**
- Requer credenciais configuradas
- URL expira (mas é regenerada automaticamente)

## 🔍 Verificar se Está Público

### Teste no Navegador

Abra a URL diretamente no navegador:
```
https://storage.googleapis.com/my-image-database-bucket/templates/card_base.png
```

- ✅ **Se carregar**: Arquivo está público
- ❌ **Se mostrar erro 403**: Arquivo não está público

### Teste via cURL

```bash
curl -I https://storage.googleapis.com/my-image-database-bucket/templates/card_base.png
```

- ✅ **Status 200**: Arquivo está público
- ❌ **Status 403**: Arquivo não está público

## 📝 Configuração Recomendada

Para templates de card, recomenda-se torná-los **públicos** porque:

1. ✅ Não contêm informações sensíveis
2. ✅ São acessados frequentemente
3. ✅ Melhor performance (sem necessidade de gerar Signed URLs)
4. ✅ Funciona mesmo sem credenciais configuradas

## ⚙️ Configuração Atual

Após tornar o arquivo público, sua variável de ambiente deve ser:

```env
CARD_DEFAULT_TEMPLATE_URL=https://storage.googleapis.com/my-image-database-bucket/templates/card_base.png
```

**Nota**: Use `storage.googleapis.com` (não `storage.cloud.google.com`) para URLs públicas.

## 🐛 Troubleshooting

### Erro 403 Persiste

1. Verifique se o arquivo realmente existe no bucket
2. Confirme que as permissões foram aplicadas corretamente
3. Aguarde alguns minutos (pode levar tempo para propagar)
4. Tente acessar a URL diretamente no navegador

### Signed URL Não Funciona

1. Verifique se `GOOGLE_CLOUD_PROJECT_ID` está configurado
2. Confirme que as credenciais estão corretas (ADC ou arquivo JSON)
3. Verifique se o arquivo existe no bucket
4. Veja os logs do servidor para mais detalhes

## 📚 Referências

- [Google Cloud Storage - Making Data Public](https://cloud.google.com/storage/docs/access-control/making-data-public)
- [Signed URLs Documentation](https://cloud.google.com/storage/docs/access-control/signing-urls-with-helpers)

