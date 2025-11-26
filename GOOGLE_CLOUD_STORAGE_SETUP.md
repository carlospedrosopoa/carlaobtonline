# 📸 Implementação de Upload de Imagens com Google Cloud Storage

Este documento descreve as melhores práticas para implementar upload de imagens usando Google Cloud Storage.

## 🎯 Comparação das Abordagens

### Abordagem 1: Frontend → API → GCS (Recomendada para Início)

**Fluxo:**
```
Frontend → [Envia imagem] → API → [Upload para GCS] → Retorna URL → Frontend salva no banco
```

**Vantagens:**
- ✅ Mais simples de implementar
- ✅ Validação centralizada na API
- ✅ Controle total sobre segurança e validações
- ✅ Não expõe credenciais do GCS no frontend
- ✅ Fácil de adicionar processamento (redimensionamento, compressão)
- ✅ Logs e auditoria centralizados

**Desvantagens:**
- ⚠️ Imagem passa pelo servidor (mais banda)
- ⚠️ Pode ser mais lento para uploads grandes
- ⚠️ Mais carga no servidor

**Quando usar:**
- Projetos pequenos/médios
- Quando precisa de validação/processamento de imagem
- Quando quer controle total sobre o upload

---

### Abordagem 2: Frontend → GCS Direto (Signed URLs) - Recomendada para Produção

**Fluxo:**
```
Frontend → [Solicita URL assinada] → API → [Retorna Signed URL]
Frontend → [Upload direto para GCS] → GCS
Frontend → [Envia URL final] → API → Salva no banco
```

**Vantagens:**
- ✅ Upload direto (mais rápido)
- ✅ Menos carga no servidor
- ✅ Melhor escalabilidade
- ✅ Menos custos de banda no servidor
- ✅ Melhor experiência do usuário

**Desvantagens:**
- ⚠️ Implementação mais complexa
- ⚠️ Precisa validar no frontend E backend
- ⚠️ Requer configuração de CORS no GCS

**Quando usar:**
- Projetos grandes
- Muitos uploads simultâneos
- Uploads de arquivos grandes
- Quando performance é crítica

---

## 🏆 Recomendação: Abordagem Híbrida

**Para começar:** Use Abordagem 1 (API recebe imagem)
**Para escalar:** Migre para Abordagem 2 (Signed URLs)

---

## 📋 Implementação Recomendada: API Recebe Imagem

### 1. Instalar Dependências

```bash
npm install @google-cloud/storage
npm install --save-dev @types/multer
npm install multer
```

### 2. Configurar Variáveis de Ambiente

**Importante:** Em produção (Vercel/Cloud Run), não é necessário configurar credenciais manualmente. As bibliotecas do Google Cloud usam **Application Default Credentials (ADC)** automaticamente.

```env
# .env.local - Configuração mínima necessária
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name

# Opcional: Apenas para desenvolvimento local (se não tiver ADC configurado)
# GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json

# Opcional: Usar chave específica em base64 (casos especiais)
# GOOGLE_CLOUD_KEY=base64-encoded-service-account-key
```

**Nota:** No Vercel/Cloud Run, você só precisa configurar `GOOGLE_CLOUD_PROJECT_ID` e `GOOGLE_CLOUD_STORAGE_BUCKET`. A autenticação é automática via Application Default Credentials.

### 3. Criar Serviço de Upload

**Arquivo: `src/lib/googleCloudStorage.ts`**

```typescript
// lib/googleCloudStorage.ts
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

// Inicializar cliente do GCS
const getStorage = () => {
  // Em produção (Vercel), usar variável de ambiente
  if (process.env.GOOGLE_CLOUD_KEY) {
    const key = JSON.parse(
      Buffer.from(process.env.GOOGLE_CLOUD_KEY, 'base64').toString()
    );
    return new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: key,
    });
  }
  
  // Em desenvolvimento local
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  }
  
  throw new Error('Google Cloud Storage não configurado');
};

const storage = getStorage();
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || '';

export interface UploadResult {
  url: string;
  fileName: string;
  size: number;
}

/**
 * Faz upload de uma imagem para o Google Cloud Storage
 * @param fileBuffer Buffer do arquivo
 * @param originalName Nome original do arquivo
 * @param folder Pasta onde salvar (ex: 'atletas', 'points')
 * @returns URL pública da imagem
 */
export async function uploadImage(
  fileBuffer: Buffer,
  originalName: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  if (!bucketName) {
    throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET não configurado');
  }

  const bucket = storage.bucket(bucketName);
  
  // Gerar nome único para o arquivo
  const extension = originalName.split('.').pop() || 'jpg';
  const fileName = `${folder}/${uuidv4()}.${extension}`;
  
  // Criar arquivo no bucket
  const file = bucket.file(fileName);
  
  // Upload do buffer
  await file.save(fileBuffer, {
    metadata: {
      contentType: `image/${extension}`,
      cacheControl: 'public, max-age=31536000', // Cache por 1 ano
    },
    public: true, // Tornar público (ou usar Signed URLs)
  });
  
  // Tornar público (se não usar public: true)
  await file.makePublic();
  
  // Retornar URL pública
  const url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
  
  return {
    url,
    fileName,
    size: fileBuffer.length,
  };
}

/**
 * Remove uma imagem do Google Cloud Storage
 */
export async function deleteImage(fileUrl: string): Promise<void> {
  if (!bucketName) return;
  
  try {
    // Extrair nome do arquivo da URL
    const fileName = fileUrl.split(`${bucketName}/`)[1];
    if (!fileName) return;
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    await file.delete();
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    // Não lançar erro - pode ser que a imagem já não exista
  }
}

/**
 * Valida se é uma imagem válida
 */
export function validateImage(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WEBP.' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'Arquivo muito grande. Máximo 5MB.' };
  }
  
  return { valid: true };
}
```

### 4. Criar Rota de Upload

**Arquivo: `src/app/api/upload/image/route.ts`**

```typescript
// app/api/upload/image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, validateImage } from '@/lib/googleCloudStorage';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    // Obter FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Arquivo não fornecido' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Validar imagem
    const validation = validateImage(file);
    if (!validation.valid) {
      const errorResponse = NextResponse.json(
        { mensagem: validation.error },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fazer upload
    const result = await uploadImage(buffer, file.name, folder);

    const response = NextResponse.json({
      url: result.url,
      fileName: result.fileName,
      size: result.size,
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao fazer upload:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao fazer upload da imagem', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
```

### 5. Atualizar Rota de Criar Atleta

**Modificar: `src/app/api/atleta/criarAtleta/route.ts`**

```typescript
// Agora aceita FormData ou JSON com fotoUrl
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    
    // Verificar se é FormData (com arquivo) ou JSON (com URL)
    const contentType = request.headers.get('content-type') || '';
    
    let fotoUrl: string | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      // Upload direto na criação
      const formData = await request.formData();
      const file = formData.get('foto') as File;
      
      if (file) {
        const { uploadImage } = await import('@/lib/googleCloudStorage');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await uploadImage(buffer, file.name, 'atletas');
        fotoUrl = result.url;
      }
      
      // Outros campos do FormData
      const nome = formData.get('nome') as string;
      const dataNascimento = formData.get('dataNascimento') as string;
      // ... outros campos
    } else {
      // JSON tradicional (já com fotoUrl)
      const body = await request.json();
      fotoUrl = body.fotoUrl || null;
      // ... resto do código
    }
    
    // Continuar criação do atleta...
  }
}
```

### 6. Uso no Frontend

```javascript
// Opção 1: Upload separado (recomendado)
async function uploadFoto(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'atletas');
  
  const response = await fetch('https://api.exemplo.com/api/upload/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const { url } = await response.json();
  return url; // Retorna URL do GCS
}

// Depois usar a URL ao criar atleta
const fotoUrl = await uploadFoto(file);
await api.post('/atleta/criarAtleta', {
  nome: 'João',
  dataNascimento: '2000-01-01',
  fotoUrl: fotoUrl // URL do GCS
});
```

---

## 🔐 Configuração no Google Cloud

### 1. Criar Bucket

```bash
# Via gcloud CLI
gsutil mb -p seu-projeto-id -l us-central1 gs://seu-bucket-name

# Ou via Console: https://console.cloud.google.com/storage
```

### 2. Configurar Permissões

```bash
# Tornar bucket público para leitura (ou usar Signed URLs)
gsutil iam ch allUsers:objectViewer gs://seu-bucket-name

# Ou configurar CORS para upload direto
gsutil cors set cors.json gs://seu-bucket-name
```

**cors.json:**
```json
[
  {
    "origin": ["https://seu-frontend.com", "http://localhost:3001"],
    "method": ["GET", "POST", "PUT"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

### 3. Criar Service Account

1. Acesse: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Crie uma Service Account
3. Adicione role: **Storage Admin** ou **Storage Object Admin**
4. Baixe a chave JSON
5. Configure no Vercel como variável de ambiente (base64)

---

## 📦 Configuração no Vercel

### Variáveis de Ambiente

**Configuração mínima (recomendada):**
```
GOOGLE_CLOUD_PROJECT_ID=seu-projeto-id
GOOGLE_CLOUD_STORAGE_BUCKET=seu-bucket-name
```

**Nota:** No Vercel, você **não precisa** configurar `GOOGLE_CLOUD_KEY` ou `GOOGLE_APPLICATION_CREDENTIALS`. O Vercel usa Application Default Credentials automaticamente quando você conecta sua conta do Google Cloud.

**Opção alternativa (apenas se necessário):**
Se precisar usar uma chave específica, você pode configurar:
```
GOOGLE_CLOUD_KEY=<base64-encoded-service-account-key>
```

**Como gerar base64 (apenas se necessário):**
```bash
# No terminal
cat service-account-key.json | base64
```

---

## 🚀 Próximos Passos (Signed URLs - Opcional)

Quando quiser migrar para upload direto:

1. Criar rota `/api/upload/signed-url` que gera URL assinada
2. Frontend solicita URL assinada
3. Frontend faz upload direto para GCS
4. Frontend envia URL final para API

**Vantagem:** Menos carga no servidor, uploads mais rápidos.

---

## 📝 Checklist de Implementação

- [x] Instalar `@google-cloud/storage` ✅ (já feito)
- [ ] Criar bucket no GCS
- [ ] Conectar conta Google Cloud no Vercel (para ADC automático)
- [ ] Configurar variáveis de ambiente:
  - [ ] `GOOGLE_CLOUD_PROJECT_ID`
  - [ ] `GOOGLE_CLOUD_STORAGE_BUCKET`
- [x] Criar `src/lib/googleCloudStorage.ts` ✅ (já feito)
- [x] Criar rota `/api/upload/image` ✅ (já feito)
- [ ] Testar upload
- [ ] Configurar CORS no bucket (se necessário)
- [x] Atualizar documentação da API ✅ (já feito)

**Nota:** Não é necessário criar Service Account manualmente se usar Application Default Credentials no Vercel.

---

## 🔗 Referências

- [Google Cloud Storage Node.js Client](https://cloud.google.com/nodejs/docs/reference/storage/latest)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [GCS Signed URLs](https://cloud.google.com/storage/docs/access-control/signing-urls-with-helpers)

