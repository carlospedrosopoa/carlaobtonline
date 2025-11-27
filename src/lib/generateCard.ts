// lib/generateCard.ts - Geração de card promocional de partida (baseado no modelo original)
import sharp from 'sharp';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { PartidaParaCard } from './cardService';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { getSignedUrl, extractFileNameFromUrl } from './googleCloudStorage';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

// Cache para verificar se a fonte já foi registrada (por instância)
let fonteRegistrada = false;
const FONTE_NOME = 'Roboto';

/**
 * Registra fonte customizada do Google Fonts para uso no canvas
 * Funciona tanto em desenvolvimento quanto em produção (Vercel)
 */
async function registrarFonteCustomizada(): Promise<void> {
  // Se já registrou nesta execução, não precisa fazer novamente
  if (fonteRegistrada) {
    console.log('[generateCard] Fontes já registradas nesta execução');
    return;
  }

  try {
    // Usar diretório temporário do sistema (funciona no Vercel)
    // No Vercel, cada função serverless tem seu próprio espaço temporário
    const fontDir = path.join(tmpdir(), 'card-fonts');
    
    // Tentar criar diretório (pode falhar se já existir, mas não é problema)
    try {
      if (!existsSync(fontDir)) {
        mkdirSync(fontDir, { recursive: true });
        console.log('[generateCard] Diretório de fontes criado:', fontDir);
      }
    } catch (mkdirError: any) {
      console.warn('[generateCard] Erro ao criar diretório (pode já existir):', mkdirError.message);
    }

    const fontPathRegular = path.join(fontDir, 'Roboto-Regular.ttf');
    const fontPathBold = path.join(fontDir, 'Roboto-Bold.ttf');

    // Baixar fonte Regular se não existir
    if (!existsSync(fontPathRegular)) {
      console.log('[generateCard] Baixando fonte Roboto Regular...');
      // Usar URL do Google Fonts CDN (mais confiável)
      const regularUrl = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf';
      try {
        const responseRegular = await axios.get(regularUrl, { 
          responseType: 'arraybuffer',
          timeout: 15000, // 15 segundos de timeout
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        writeFileSync(fontPathRegular, Buffer.from(responseRegular.data));
        console.log('[generateCard] ✅ Fonte Roboto Regular baixada:', fontPathRegular, 'tamanho:', responseRegular.data.byteLength, 'bytes');
      } catch (error: any) {
        console.error('[generateCard] Erro ao baixar Roboto Regular:', error.message);
        throw error;
      }
    } else {
      console.log('[generateCard] Fonte Roboto Regular já existe, reutilizando');
    }

    // Baixar fonte Bold se não existir
    if (!existsSync(fontPathBold)) {
      console.log('[generateCard] Baixando fonte Roboto Bold...');
      // Usar URL do Google Fonts CDN (mais confiável)
      const boldUrl = 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf';
      try {
        const responseBold = await axios.get(boldUrl, { 
          responseType: 'arraybuffer',
          timeout: 15000, // 15 segundos de timeout
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        });
        writeFileSync(fontPathBold, Buffer.from(responseBold.data));
        console.log('[generateCard] ✅ Fonte Roboto Bold baixada:', fontPathBold, 'tamanho:', responseBold.data.byteLength, 'bytes');
      } catch (error: any) {
        console.error('[generateCard] Erro ao baixar Roboto Bold:', error.message);
        throw error;
      }
    } else {
      console.log('[generateCard] Fonte Roboto Bold já existe, reutilizando');
    }

    // Verificar se os arquivos existem antes de registrar
    if (!existsSync(fontPathRegular) || !existsSync(fontPathBold)) {
      throw new Error('Arquivos de fonte não foram baixados corretamente');
    }

    // Registrar as fontes no canvas
    console.log('[generateCard] Registrando fontes no canvas...');
    registerFont(fontPathRegular, { family: FONTE_NOME, weight: 'normal' });
    registerFont(fontPathBold, { family: FONTE_NOME, weight: 'bold' });
    
    fonteRegistrada = true;
    console.log('[generateCard] ✅ Fontes Roboto registradas com sucesso no canvas');
  } catch (error: any) {
    console.error('[generateCard] ❌ Erro ao registrar fonte customizada:', error.message);
    console.error('[generateCard] Stack:', error.stack);
    console.warn('[generateCard] Continuando com fonte genérica sans-serif');
    fonteRegistrada = false; // Garantir que não tenta usar fonte não registrada
  }
}

// Função para obter fonte compatível com o ambiente (Linux no Vercel)
function obterFonteCompativel(tamanho: number, peso: string = 'normal'): string {
  const pesoTexto = peso === 'bold' ? 'bold' : 'normal';
  
  // Tentar usar fonte customizada se registrada, senão usar genérica
  if (fonteRegistrada) {
    return `${pesoTexto} ${tamanho}px "${FONTE_NOME}", sans-serif`;
  }
  
  // Fallback para fonte genérica
  return `${pesoTexto} ${tamanho}px sans-serif`;
}

/**
 * Gera um card promocional PNG da partida
 * Baseado no modelo original que usava template + Canvas
 * @param partida - Dados da partida incluindo templateUrl (se já foi gerado antes)
 * @param templateUrl - URL do template a usar (opcional, prioriza templateUrl da partida)
 */
export async function generateMatchCard(
  partida: PartidaParaCard,
  templateUrl?: string | null
): Promise<Buffer> {
  try {
    console.log('[generateCard] Iniciando geração do card...');
    
    // Registrar fonte customizada antes de criar o canvas
    await registrarFonteCustomizada();
    
    // Dimensões do card (1080x1920px - formato vertical como no original)
    const largura = 1080;
    const altura = 1920;
    
    const canvas = createCanvas(largura, altura);
    const ctx = canvas.getContext('2d');
    
    // Função para normalizar URL do GCS (converter storage.cloud.google.com para storage.googleapis.com)
    const normalizarUrlGCS = (url: string): string => {
      // storage.cloud.google.com requer autenticação, storage.googleapis.com é público
      if (url.includes('storage.cloud.google.com')) {
        const urlNormalizada = url.replace('storage.cloud.google.com', 'storage.googleapis.com');
        console.log('[generateCard] URL normalizada de storage.cloud.google.com para storage.googleapis.com');
        return urlNormalizada;
      }
      return url;
    };

    // Função para carregar imagem remota (definida antes de usar)
    const carregarImagemRemota = async (url?: string | null): Promise<any> => {
      if (!url) {
        console.log('[generateCard] URL vazia, usando avatar padrão');
        return null;
      }
      
      // Normalizar URL do GCS se necessário
      const urlNormalizada = normalizarUrlGCS(url);
      console.log('[generateCard] Tentando carregar imagem:', urlNormalizada.substring(0, 80) + '...');
      
      try {
        // Se for URL HTTP/HTTPS
        if (urlNormalizada.startsWith('http://') || urlNormalizada.startsWith('https://')) {
          console.log('[generateCard] Carregando imagem HTTP/HTTPS...');
          const response = await axios.get(urlNormalizada, {
            responseType: 'arraybuffer',
            timeout: 15000, // 15 segundos de timeout (aumentado para templates grandes)
            headers: {
              'Accept': 'image/*',
            },
            // Não seguir redirects automaticamente, tratar manualmente
            maxRedirects: 5,
          });
          
          if (response.status !== 200) {
            console.warn(`[generateCard] Resposta HTTP ${response.status} ao carregar template`);
            return null;
          }
          
          const buffer = Buffer.from(response.data);
          if (buffer.length === 0) {
            console.warn('[generateCard] Buffer vazio ao carregar template');
            return null;
          }
          
          const img = await loadImage(buffer);
          console.log('[generateCard] Imagem HTTP/HTTPS carregada com sucesso, tamanho:', buffer.length, 'bytes');
          return img;
        }
        
        // Se for base64
        if (url.startsWith('data:image/')) {
          console.log('[generateCard] Carregando imagem base64...');
          const base64Data = url.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const img = await loadImage(buffer);
          console.log('[generateCard] Imagem base64 carregada com sucesso');
          return img;
        }
        
        console.warn('[generateCard] Formato de URL não reconhecido:', url.substring(0, 50));
        return null;
      } catch (error: any) {
        console.error('[generateCard] Erro ao carregar imagem remota:', error.message);
        console.error('[generateCard] Stack:', error.stack);
        return null;
      }
    };
    
    // Prioridade: templateUrl da partida > templateUrl passado > template padrão > fundo programático
    const urlTemplateFinal = partida.templateUrl || templateUrl || null;
    let templateCarregado = false;
    
    // Tentar carregar template da URL (GCS ou local)
    if (urlTemplateFinal) {
      try {
        console.log('[generateCard] Tentando carregar template da URL:', urlTemplateFinal);
        let background = await carregarImagemRemota(urlTemplateFinal);
        
        // Se falhou com 403, tentar usar Signed URL
        if (!background && urlTemplateFinal.includes('storage.googleapis.com')) {
          console.log('[generateCard] Tentando gerar Signed URL para template privado...');
          const fileName = extractFileNameFromUrl(urlTemplateFinal);
          if (fileName) {
            const signedUrl = await getSignedUrl(fileName, 3600); // 1 hora de validade
            if (signedUrl) {
              console.log('[generateCard] Signed URL gerada, tentando carregar...');
              background = await carregarImagemRemota(signedUrl);
            }
          }
        }
        
        if (background) {
          ctx.drawImage(background, 0, 0, largura, altura);
          templateCarregado = true;
          console.log('[generateCard] ✅ Template carregado da URL com sucesso');
        } else {
          console.warn('[generateCard] ⚠️ Template não foi carregado (background é null)');
          console.warn('[generateCard] 💡 Dica: Torne o arquivo público no GCS ou verifique as permissões');
        }
      } catch (error: any) {
        console.error('[generateCard] ❌ Erro ao carregar template da URL:', error.message);
        console.error('[generateCard] Stack:', error.stack);
        // Se erro 403, sugerir tornar público
        if (error.response?.status === 403) {
          console.error('[generateCard] 💡 O arquivo não está público. Opções:');
          console.error('[generateCard]    1. Torne o arquivo público no GCS (recomendado)');
          console.error('[generateCard]    2. Ou use Signed URLs (implementado automaticamente)');
        }
      }
    } else {
      console.log('[generateCard] ⚠️ Nenhuma URL de template fornecida');
    }
    
    // Fallback: tentar carregar template local se não tiver URL
    if (!templateCarregado) {
      const templatePath = path.join(process.cwd(), 'public', 'templates', 'card_base.png');
      try {
        if (fs.existsSync(templatePath)) {
          const background = await loadImage(templatePath);
          ctx.drawImage(background, 0, 0, largura, altura);
          templateCarregado = true;
          console.log('[generateCard] Template local carregado');
        }
      } catch (error) {
        console.warn('[generateCard] Template local não encontrado');
      }
    }
    
    // Se não tiver template, criar fundo programático
    if (!templateCarregado) {
      // Criar gradiente de fundo
      const gradient = ctx.createLinearGradient(0, 0, 0, altura);
      gradient.addColorStop(0, '#0f172a'); // Slate-900
      gradient.addColorStop(0.5, '#1e293b'); // Slate-800
      gradient.addColorStop(1, '#0f172a'); // Slate-900
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, largura, altura);
      console.log('[generateCard] Fundo programático criado');
    }
    
    // Carregar imagem padrão (avatar)
    let imgPadrao: any = null;
    const avatarPath = path.join(process.cwd(), 'public', 'avatar.png');
    try {
      if (fs.existsSync(avatarPath)) {
        imgPadrao = await loadImage(avatarPath);
        console.log('[generateCard] Avatar padrão carregado');
      } else {
        // Criar avatar padrão programático se não existir (tamanho 440x440)
        const avatarSize = 440;
        const avatarCanvas = createCanvas(avatarSize, avatarSize);
        const avatarCtx = avatarCanvas.getContext('2d');
        avatarCtx.fillStyle = '#475569';
        avatarCtx.beginPath();
        avatarCtx.arc(avatarSize / 2, avatarSize / 2, avatarSize / 2 - 10, 0, Math.PI * 2);
        avatarCtx.fill();
        // Silhueta simples
        avatarCtx.fillStyle = '#64748b';
        avatarCtx.beginPath();
        avatarCtx.arc(avatarSize / 2, avatarSize / 2 - 60, 60, 0, Math.PI * 2);
        avatarCtx.fill();
        avatarCtx.beginPath();
        avatarCtx.arc(avatarSize / 2, avatarSize / 2 + 60, 100, 0, Math.PI, true);
        avatarCtx.fill();
        imgPadrao = await loadImage(avatarCanvas.toBuffer('image/png'));
        console.log('[generateCard] Avatar padrão criado programaticamente');
      }
    } catch (error) {
      console.error('[generateCard] Erro ao carregar avatar padrão:', error);
    }
    
    // Carregar fotos dos atletas
    const atletas = [
      partida.atleta1,
      partida.atleta2,
      partida.atleta3,
      partida.atleta4,
    ];
    
    console.log('[generateCard] Carregando fotos dos atletas...');
    console.log('[generateCard] URLs das fotos:', {
      atleta1: partida.atleta1?.fotoUrl?.substring(0, 50) || 'null',
      atleta2: partida.atleta2?.fotoUrl?.substring(0, 50) || 'null',
      atleta3: partida.atleta3?.fotoUrl?.substring(0, 50) || 'null',
      atleta4: partida.atleta4?.fotoUrl?.substring(0, 50) || 'null',
    });
    
    const imagens = await Promise.all(
      atletas.map(async (atleta, index) => {
        if (!atleta) {
          console.log(`[generateCard] Atleta ${index + 1} não existe, usando avatar padrão`);
          return imgPadrao;
        }
        const img = await carregarImagemRemota(atleta.fotoUrl);
        if (!img) {
          console.log(`[generateCard] Não foi possível carregar foto do atleta ${index + 1} (${atleta.nome}), usando avatar padrão`);
          return imgPadrao;
        }
        console.log(`[generateCard] Foto do atleta ${index + 1} (${atleta.nome}) carregada com sucesso`);
        return img;
      })
    );
    console.log('[generateCard] Fotos carregadas:', imagens.filter(img => img !== imgPadrao).length, 'fotos reais,', imagens.filter(img => img === imgPadrao).length, 'avatares padrão');
    
    // Posições das fotos - tamanho dobrado
    const tamanho = 440; // Dobrado de 220 para 440
    const posicoesFotos: Array<[number, number]> = [
      [40, 320],   // Atleta 1 (esquerda, topo) - ajustado para acomodar foto maior
      [40, 860],   // Atleta 2 (esquerda, baixo) - descido mais (era 800)
      [620, 320],  // Atleta 3 (direita, topo) - ajustado
      [620, 860],  // Atleta 4 (direita, baixo) - descido mais (era 800)
    ];
    
    // Desenhar fotos dos atletas (mantendo proporção)
    console.log('[generateCard] Desenhando fotos...');
    imagens.forEach((img, i) => {
      if (img) {
        const x = posicoesFotos[i][0];
        const y = posicoesFotos[i][1];
        const centerX = x + tamanho / 2;
        const centerY = y + tamanho / 2;
        const radius = tamanho / 2 - 5;
        
        // Calcular proporção para manter aspect ratio (crop centralizado)
        const imgAspect = img.width / img.height;
        const targetAspect = 1; // Quadrado (tamanho x tamanho)
        
        let drawWidth = tamanho;
        let drawHeight = tamanho;
        let drawX = x;
        let drawY = y;
        
        // Se a imagem for mais larga que alta, ajustar altura e centralizar horizontalmente
        if (imgAspect > targetAspect) {
          drawHeight = tamanho;
          drawWidth = tamanho * imgAspect;
          drawX = x - (drawWidth - tamanho) / 2;
        } else {
          // Se a imagem for mais alta que larga, ajustar largura e centralizar verticalmente
          drawWidth = tamanho;
          drawHeight = tamanho / imgAspect;
          drawY = y - (drawHeight - tamanho) / 2;
        }
        
        // Criar círculo para a foto (clip)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // Desenhar imagem mantendo proporção (crop centralizado)
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
        
        // Borda branca
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    
    // Textos - Nomes dos atletas (abaixo das fotos, não sobrepostos)
    ctx.fillStyle = '#ffffff';
    const fonteNomes = obterFonteCompativel(32, 'bold');
    ctx.font = fonteNomes;
    console.log('[generateCard] Fonte usada para nomes:', fonteNomes);
    ctx.textAlign = 'center'; // Centralizado abaixo da foto
    ctx.textBaseline = 'top';
    
    // Sombra para melhor legibilidade
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    if (partida.atleta1) {
      const nome = partida.atleta1.nome || 'A Definir';
      const x = posicoesFotos[0][0] + tamanho / 2; // Centro da foto
      const y = posicoesFotos[0][1] + tamanho + 25; // Abaixo da foto (aumentado espaçamento de 15 para 25)
      console.log('[generateCard] Desenhando nome atleta1:', nome, 'em', x, y);
      ctx.fillText(nome, x, y);
    }
    if (partida.atleta2) {
      const nome = partida.atleta2.nome || 'A Definir';
      const x = posicoesFotos[1][0] + tamanho / 2;
      const y = posicoesFotos[1][1] + tamanho + 25; // Abaixo da foto (aumentado espaçamento de 15 para 25)
      console.log('[generateCard] Desenhando nome atleta2:', nome, 'em', x, y);
      ctx.fillText(nome, x, y);
    }
    if (partida.atleta3) {
      const nome = partida.atleta3.nome || 'A Definir';
      const x = posicoesFotos[2][0] + tamanho / 2;
      const y = posicoesFotos[2][1] + tamanho + 25; // Abaixo da foto (aumentado espaçamento de 15 para 25)
      console.log('[generateCard] Desenhando nome atleta3:', nome, 'em', x, y);
      ctx.fillText(nome, x, y);
    }
    if (partida.atleta4) {
      const nome = partida.atleta4.nome || 'A Definir';
      const x = posicoesFotos[3][0] + tamanho / 2;
      const y = posicoesFotos[3][1] + tamanho + 25; // Abaixo da foto (aumentado espaçamento de 15 para 25)
      console.log('[generateCard] Desenhando nome atleta4:', nome, 'em', x, y);
      ctx.fillText(nome, x, y);
    }
    
    // Remover sombra para outros textos
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Info principal - Título (mais à direita para não sobrepor logo)
    const fonteTitulo = obterFonteCompativel(36, 'bold');
    ctx.font = fonteTitulo;
    console.log('[generateCard] Fonte usada para título:', fonteTitulo);
    ctx.textAlign = 'right'; // Alinhado à direita
    const tituloTexto = 'Jogo Amistoso';
    console.log('[generateCard] Desenhando título:', tituloTexto);
    ctx.fillText(tituloTexto, largura - 50, 100); // 50px da borda direita
    
    // Data e hora
    const dataJogo = new Date(partida.data);
    const dia = dataJogo.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const hora = dataJogo.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const fonteData = obterFonteCompativel(42, 'bold');
    ctx.font = fonteData;
    console.log('[generateCard] Fonte usada para data:', fonteData);
    const dataTexto = `${dia} - ${hora}`;
    console.log('[generateCard] Desenhando data:', dataTexto);
    ctx.fillText(dataTexto, largura - 50, 150); // 50px da borda direita
    
    // Local
    const fonteLocal = obterFonteCompativel(36, 'bold');
    ctx.font = fonteLocal;
    console.log('[generateCard] Fonte usada para local:', fonteLocal);
    const localTexto = partida.local || 'Local não informado';
    console.log('[generateCard] Desenhando local:', localTexto);
    ctx.fillText(localTexto, largura - 50, 200); // 50px da borda direita
    
    // Placar (se existir) - alinhado com os nomes dos atletas de baixo
    if (partida.gamesTime1 !== null && partida.gamesTime2 !== null) {
      const fontePlacar = obterFonteCompativel(200, 'bold');
      ctx.font = fontePlacar;
      console.log('[generateCard] Fonte usada para placar:', fontePlacar);
      ctx.textAlign = 'center'; // Centralizado horizontalmente
      ctx.fillStyle = '#fbbf24'; // Amarelo
      
      // Adicionar sombra para melhor legibilidade
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      
      let placarTexto = `${partida.gamesTime1} x ${partida.gamesTime2}`;
      if (partida.tiebreakTime1 !== null && partida.tiebreakTime2 !== null) {
        placarTexto += ` (${partida.tiebreakTime1} x ${partida.tiebreakTime2})`;
      }
      console.log('[generateCard] Desenhando placar:', placarTexto);
      // Alinhado com os nomes dos atletas de baixo
      // Nomes de baixo: y = posicoesFotos[1][1] + tamanho + 25 = 860 + 440 + 25 = 1325
      ctx.fillText(placarTexto, largura / 2, 1325);
      
      // Remover sombra
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      ctx.fillStyle = '#fff'; // Resetar cor
    }
    
    // VS removido - já está no template
    // Linha divisória também removida - já está no template
    
    console.log('[generateCard] Textos desenhados');
    
    // Converter Canvas para Buffer PNG
    const buffer = canvas.toBuffer('image/png');
    console.log('[generateCard] Card gerado com sucesso, tamanho:', buffer.length, 'bytes');
    
    return buffer;
  } catch (error: any) {
    console.error('[generateCard] Erro na geração:', error);
    throw new Error(`Erro ao gerar card: ${error.message}`);
  }
}
