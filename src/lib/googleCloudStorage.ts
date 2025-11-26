// lib/googleCloudStorage.ts - Serviço de upload para Google Cloud Storage
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'fs';
import path from 'path';

// Inicializar cliente do GCS
const getStorage = () => {
  // Em produção (Vercel/Cloud Run), usar Application Default Credentials (ADC)
  // As bibliotecas do Google Cloud fazem autenticação automática
  // Apenas precisa do projectId e bucket configurados
  
  // Opção 1: Usar chave em base64 (se fornecido - para casos específicos)
  if (process.env.GOOGLE_CLOUD_KEY) {
    try {
      const key = JSON.parse(
        Buffer.from(process.env.GOOGLE_CLOUD_KEY, 'base64').toString()
      );
      return new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: key,
      });
    } catch (error) {
      console.error('Erro ao parsear GOOGLE_CLOUD_KEY:', error);
      throw new Error('Configuração inválida do Google Cloud Storage');
    }
  }
  
  // Opção 2: Usar arquivo de credenciais (apenas para desenvolvimento local)
  // Verificar se o arquivo existe antes de tentar usar
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (existsSync(credentialsPath)) {
      return new Storage({
        keyFilename: credentialsPath,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      });
    } else {
      console.warn(`Arquivo de credenciais não encontrado: ${credentialsPath}. Tentando usar ADC...`);
    }
  }
  
  // Opção 3: Application Default Credentials (ADC) - automático em Cloud Run/Vercel
  // Não precisa configurar credenciais - a biblioteca detecta automaticamente
  if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
    try {
      return new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        // Sem credentials - usa ADC automaticamente
      });
    } catch (error) {
      console.error('Erro ao inicializar Storage com ADC:', error);
      // Em desenvolvimento, permite continuar sem GCS
      if (process.env.NODE_ENV === 'development') {
        console.warn('ADC não disponível. Uploads serão ignorados em desenvolvimento.');
        return null;
      }
      throw error;
    }
  }
  
  // Se não configurado, retornar null (permitir funcionar sem GCS)
  if (process.env.NODE_ENV === 'development') {
    console.warn('Google Cloud Storage não configurado. Uploads serão ignorados.');
    return null;
  }
  
  throw new Error('Google Cloud Storage não configurado');
};

let storageInstance: Storage | null = null;
try {
  storageInstance = getStorage();
} catch (error) {
  console.error('Erro ao inicializar Google Cloud Storage:', error);
}

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
  // Se não configurado, retornar URL mock em desenvolvimento
  if (!storageInstance || !bucketName) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('GCS não configurado - retornando URL mock');
      return {
        url: `https://via.placeholder.com/300?text=${encodeURIComponent(originalName)}`,
        fileName: `${folder}/${uuidv4()}.jpg`,
        size: fileBuffer.length,
      };
    }
    throw new Error('Google Cloud Storage não configurado');
  }

  const bucket = storageInstance.bucket(bucketName);
  
  // Gerar nome único para o arquivo
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${folder}/${uuidv4()}.${extension}`;
  
  // Criar arquivo no bucket
  const file = bucket.file(fileName);
  
  // Determinar content type
  const contentTypeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const contentType = contentTypeMap[extension] || 'image/jpeg';
  
  // Upload do buffer
  await file.save(fileBuffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000', // Cache por 1 ano
    },
    public: true, // Tornar público
  });
  
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
  if (!storageInstance || !bucketName) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('GCS não configurado - ignorando delete');
      return;
    }
    return;
  }
  
  try {
    // Extrair nome do arquivo da URL
    const fileName = fileUrl.split(`${bucketName}/`)[1];
    if (!fileName) {
      console.warn('Não foi possível extrair nome do arquivo da URL:', fileUrl);
      return;
    }
    
    const bucket = storageInstance.bucket(bucketName);
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log('Imagem deletada:', fileName);
    }
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
    return { 
      valid: false, 
      error: 'Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WEBP.' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'Arquivo muito grande. Máximo 5MB.' 
    };
  }
  
  return { valid: true };
}

/**
 * Converte base64 para Buffer (para compatibilidade com código existente)
 */
export function base64ToBuffer(base64String: string): Buffer {
  // Remove data URL prefix se existir (ex: "data:image/jpeg;base64,")
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  return Buffer.from(base64Data, 'base64');
}

/**
 * Gera uma Signed URL para um arquivo no GCS (útil quando o arquivo não é público)
 * @param fileName Nome do arquivo no bucket (ex: 'templates/card_base.png')
 * @param expiresIn Segundos até a URL expirar (padrão: 1 hora)
 * @returns Signed URL ou null se não conseguir gerar
 */
export async function getSignedUrl(
  fileName: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!storageInstance || !bucketName) {
    console.warn('[GCS] Storage não configurado, não é possível gerar signed URL');
    return null;
  }

  try {
    const bucket = storageInstance.bucket(bucketName);
    const file = bucket.file(fileName);
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    
    return url;
  } catch (error: any) {
    console.error('[GCS] Erro ao gerar signed URL:', error.message);
    return null;
  }
}

/**
 * Extrai o nome do arquivo de uma URL do GCS
 * Ex: https://storage.googleapis.com/bucket/templates/card.png -> templates/card.png
 */
export function extractFileNameFromUrl(url: string): string | null {
  try {
    // storage.googleapis.com/bucket-name/path/to/file
    if (url.includes('storage.googleapis.com/')) {
      const parts = url.split('storage.googleapis.com/');
      if (parts.length > 1) {
        const path = parts[1];
        // Remove o nome do bucket (primeira parte)
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
          return pathParts.slice(1).join('/');
        }
      }
    }
    
    // storage.cloud.google.com/bucket-name/path/to/file
    if (url.includes('storage.cloud.google.com/')) {
      const parts = url.split('storage.cloud.google.com/');
      if (parts.length > 1) {
        const path = parts[1];
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
          return pathParts.slice(1).join('/');
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

