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
let usandoFonteSistema = false;
const FONTE_NOME = 'Roboto';
const FONTE_SISTEMA = 'DejaVu Sans'; // Fonte padrão do Linux disponível no Vercel

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

    // Tentar múltiplas URLs para baixar fonte Regular
    const urlsRegular = [
      'https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf',
      'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf',
      'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Regular.ttf',
    ];

    if (!existsSync(fontPathRegular)) {
      console.log('[generateCard] Tentando baixar fonte Roboto Regular...');
      let baixado = false;
      
      for (const url of urlsRegular) {
        try {
          console.log('[generateCard] Tentando URL:', url);
          const responseRegular = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          
          if (responseRegular.status === 200 && responseRegular.data.byteLength > 0) {
            writeFileSync(fontPathRegular, Buffer.from(responseRegular.data));
            console.log('[generateCard] ✅ Fonte Roboto Regular baixada:', fontPathRegular, 'tamanho:', responseRegular.data.byteLength, 'bytes');
            baixado = true;
            break;
          }
        } catch (error: any) {
          console.warn('[generateCard] Erro ao baixar de', url, ':', error.message);
          continue;
        }
      }
      
      if (!baixado) {
        console.warn('[generateCard] ⚠️ Não foi possível baixar Roboto Regular de nenhuma URL.');
        // Tentar baixar uma fonte alternativa que sabemos que funciona
        console.log('[generateCard] Tentando baixar fonte alternativa (Open Sans)...');
        const openSansUrl = 'https://github.com/google/fonts/raw/main/apache/opensans/OpenSans-Regular.ttf';
        try {
          const responseAlt = await axios.get(openSansUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          if (responseAlt.status === 200 && responseAlt.data.byteLength > 0) {
            writeFileSync(fontPathRegular, Buffer.from(responseAlt.data));
            console.log('[generateCard] ✅ Fonte alternativa (Open Sans) baixada como fallback');
            baixado = true;
          }
        } catch (error: any) {
          console.warn('[generateCard] Também não foi possível baixar fonte alternativa:', error.message);
          usandoFonteSistema = true;
        }
      }
    } else {
      console.log('[generateCard] Fonte Roboto Regular já existe, reutilizando');
    }

    // Tentar múltiplas URLs para baixar fonte Bold
    const urlsBold = [
      'https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Bold.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Bold.ttf',
      'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf',
      'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Bold.ttf',
    ];

    if (!existsSync(fontPathBold) && !usandoFonteSistema) {
      console.log('[generateCard] Tentando baixar fonte Roboto Bold...');
      let baixado = false;
      
      for (const url of urlsBold) {
        try {
          console.log('[generateCard] Tentando URL:', url);
          const responseBold = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          
          if (responseBold.status === 200 && responseBold.data.byteLength > 0) {
            writeFileSync(fontPathBold, Buffer.from(responseBold.data));
            console.log('[generateCard] ✅ Fonte Roboto Bold baixada:', fontPathBold, 'tamanho:', responseBold.data.byteLength, 'bytes');
            baixado = true;
            break;
          }
        } catch (error: any) {
          console.warn('[generateCard] Erro ao baixar de', url, ':', error.message);
          continue;
        }
      }
      
      if (!baixado) {
        console.warn('[generateCard] ⚠️ Não foi possível baixar Roboto Bold de nenhuma URL. Usando fonte do sistema.');
        usandoFonteSistema = true;
      }
    } else if (usandoFonteSistema) {
      console.log('[generateCard] Pulando download de Bold (usando fonte do sistema)');
    } else {
      console.log('[generateCard] Fonte Roboto Bold já existe, reutilizando');
    }

    // Se não conseguiu baixar as fontes, usar fonte do sistema
    if (usandoFonteSistema) {
      console.log('[generateCard] Usando fonte do sistema:', FONTE_SISTEMA);
      fonteRegistrada = true; // Marcar como registrada para usar fonte do sistema
      return; // Não precisa registrar, vai usar fonte do sistema diretamente
    }

    // Verificar se pelo menos a fonte Regular existe
    if (!existsSync(fontPathRegular)) {
      console.warn('[generateCard] ⚠️ Fonte Regular não encontrada. Usando fonte do sistema.');
      usandoFonteSistema = true;
      fonteRegistrada = true;
      return;
    }

    // Registrar as fontes no canvas
    console.log('[generateCard] Registrando fontes no canvas...');
    console.log('[generateCard] Caminho da fonte Regular:', fontPathRegular);
    console.log('[generateCard] Arquivo Regular existe?', existsSync(fontPathRegular));
    console.log('[generateCard] Tamanho do arquivo Regular:', existsSync(fontPathRegular) ? fs.statSync(fontPathRegular).size : 'N/A');
    
    try {
      // Sempre registrar a fonte Regular (se existir)
      console.log('[generateCard] Chamando registerFont para Regular...');
      registerFont(fontPathRegular, { family: FONTE_NOME, weight: 'normal' });
      console.log('[generateCard] ✅ Fonte Roboto Regular registrada com sucesso');
      
      // Tentar registrar Bold se existir, senão usar Regular para bold também
      if (existsSync(fontPathBold)) {
        console.log('[generateCard] Caminho da fonte Bold:', fontPathBold);
        console.log('[generateCard] Chamando registerFont para Bold...');
        registerFont(fontPathBold, { family: FONTE_NOME, weight: 'bold' });
        console.log('[generateCard] ✅ Fonte Roboto Bold registrada com sucesso');
      } else {
        // Se Bold não existe, registrar Regular também como bold (não ideal, mas funciona)
        console.warn('[generateCard] ⚠️ Fonte Bold não encontrada, usando Regular para bold também');
        console.log('[generateCard] Chamando registerFont para Regular como bold...');
        registerFont(fontPathRegular, { family: FONTE_NOME, weight: 'bold' });
        console.log('[generateCard] ✅ Fonte Regular registrada como bold');
      }
      
      fonteRegistrada = true;
      usandoFonteSistema = false;
      console.log('[generateCard] ✅ Todas as fontes registradas com sucesso no canvas');
      console.log('[generateCard] fonteRegistrada:', fonteRegistrada, 'usandoFonteSistema:', usandoFonteSistema);
    } catch (error: any) {
      console.error('[generateCard] ❌ Erro ao registrar fontes:', error.message);
      console.error('[generateCard] Erro name:', error.name);
      console.error('[generateCard] Erro code:', error.code);
      console.error('[generateCard] Stack:', error.stack);
      console.warn('[generateCard] ⚠️ Fontconfig pode não estar configurado. Tentando continuar...');
      // Mesmo com erro, marcar como registrada para tentar usar
      // O node-canvas pode funcionar mesmo com erro de fontconfig
      fonteRegistrada = true;
      usandoFonteSistema = false; // Tentar usar fonte registrada mesmo com erro
      console.log('[generateCard] Continuando com fonteRegistrada=true, usandoFonteSistema=false');
    }
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
  
  // Prioridade: usar fonte registrada se disponível E não estiver usando fonte do sistema
  if (fonteRegistrada && !usandoFonteSistema) {
    const fonte = `${pesoTexto} ${tamanho}px "${FONTE_NOME}"`;
    console.log('[generateCard] ✅ Usando fonte customizada Roboto:', fonte);
    return fonte;
  }
  
  // Se fonte foi registrada mas está marcada como sistema, ainda tentar usar Roboto
  // (pode ter sido registrada mesmo com erro de fontconfig)
  if (fonteRegistrada) {
    const fonte = `${pesoTexto} ${tamanho}px "${FONTE_NOME}"`;
    console.log('[generateCard] ⚠️ Tentando usar Roboto mesmo com flag de sistema:', fonte);
    return fonte;
  }
  
  // Se não conseguiu registrar fonte customizada, tentar baixar uma fonte básica que funciona
  // Ou usar uma fonte que sabemos que existe no sistema
  // No node-canvas, precisamos de uma fonte registrada ou uma fonte do sistema disponível
  
  // Tentar usar uma fonte que definitivamente funciona no Linux
  // Liberation Sans geralmente está disponível em sistemas Linux
  const fonteSistema = `${pesoTexto} ${tamanho}px "Liberation Sans", "Arial", "Helvetica", "DejaVu Sans", sans-serif`;
  console.log('[generateCard] ⚠️ Usando fonte do sistema (fallback):', fonteSistema);
  console.log('[generateCard] usandoFonteSistema:', usandoFonteSistema, 'fonteRegistrada:', fonteRegistrada);
  console.log('[generateCard] ⚠️ Se ainda aparecerem quadrados, pode ser necessário instalar fontes no sistema');
  return fonteSistema;
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
    
    // Garantir que o canvas está configurado para UTF-8
    // Isso ajuda a evitar problemas com caracteres especiais
    console.log('[generateCard] Canvas criado, dimensões:', largura, 'x', altura);
    
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
    console.log('[generateCard] fillStyle antes de desenhar nomes:', ctx.fillStyle);
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
      console.log('[generateCard] Desenhando nome atleta1:', nome, 'em', x, y, 'fillStyle:', ctx.fillStyle, 'font:', ctx.font);
      
      // Verificar se a fonte está aplicada corretamente
      const metrics = ctx.measureText(nome);
      console.log('[generateCard] Métricas do texto atleta1 - largura:', metrics.width, 'altura:', metrics.actualBoundingBoxAscent);
      
      if (metrics.width === 0) {
        console.error('[generateCard] ⚠️ ATENÇÃO: Texto tem largura 0 - fonte não está funcionando!');
        // Tentar forçar uma fonte diferente
        ctx.font = `${32}px sans-serif`;
        console.log('[generateCard] Tentando com fonte forçada:', ctx.font);
      }
      
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
    ctx.fillStyle = '#ffffff'; // Garantir cor branca
    const fonteTitulo = obterFonteCompativel(36, 'bold');
    ctx.font = fonteTitulo;
    console.log('[generateCard] Fonte usada para título:', fonteTitulo);
    ctx.textAlign = 'right'; // Alinhado à direita
    ctx.textBaseline = 'top';
    const tituloTexto = 'Jogo Amistoso';
    console.log('[generateCard] Desenhando título:', tituloTexto, 'cor:', ctx.fillStyle);
    ctx.fillText(tituloTexto, largura - 50, 100); // 50px da borda direita
    
    // Data e hora
    ctx.fillStyle = '#ffffff'; // Garantir cor branca
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
    console.log('[generateCard] Desenhando data:', dataTexto, 'cor:', ctx.fillStyle);
    ctx.fillText(dataTexto, largura - 50, 150); // 50px da borda direita
    
    // Local
    ctx.fillStyle = '#ffffff'; // Garantir cor branca
    const fonteLocal = obterFonteCompativel(36, 'bold');
    ctx.font = fonteLocal;
    console.log('[generateCard] Fonte usada para local:', fonteLocal);
    const localTexto = partida.local || 'Local não informado';
    console.log('[generateCard] Desenhando local:', localTexto, 'cor:', ctx.fillStyle);
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
