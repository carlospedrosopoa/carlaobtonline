// app/api/point/[id]/route.ts - Rotas de API para Point individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, base64ToBuffer, deleteImage } from '@/lib/googleCloudStorage';

// GET /api/point/[id] - Obter point por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Tentar primeiro com todos os campos (WhatsApp, Gzappy, cardTemplateUrl)
    let result;
    try {
      result = await query(
        `SELECT 
          id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
          "enviarLembretesAgendamento", "antecedenciaLembrete",
          "infinitePayHandle",
          assinante, "createdAt", "updatedAt"
        FROM "Point"
        WHERE id = $1`,
        [id]
      );
    } catch (error: any) {
      // Se falhar (colunas não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('cardTemplateUrl') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Alguns campos não encontrados, usando query básica');
        try {
          // Tentar com cardTemplateUrl
          result = await query(
            `SELECT 
              id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
              assinante, "createdAt", "updatedAt"
            FROM "Point"
            WHERE id = $1`,
            [id]
          );
        } catch (error2: any) {
          // Se ainda falhar, tentar sem cardTemplateUrl
          if (error2.message?.includes('cardTemplateUrl') || error2.code === '42703') {
            console.log('⚠️ Campo cardTemplateUrl não encontrado, usando query sem ele');
            result = await query(
              `SELECT 
                id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
                assinante, "createdAt", "updatedAt"
              FROM "Point"
              WHERE id = $1`,
              [id]
            );
          } else {
            throw error2;
          }
        }
        // Adicionar campos faltantes como null para compatibilidade
        if (result.rows.length > 0) {
          result.rows[0] = {
            ...result.rows[0],
            cardTemplateUrl: result.rows[0].cardTemplateUrl ?? null,
            whatsappAccessToken: null,
            whatsappPhoneNumberId: null,
            whatsappBusinessAccountId: null,
            whatsappApiVersion: 'v21.0',
            whatsappAtivo: false,
            gzappyApiKey: null,
            gzappyInstanceId: null,
            gzappyAtivo: false,
            enviarLembretesAgendamento: false,
            antecedenciaLembrete: 8,
            infinitePayHandle: null,
            assinante: result.rows[0].assinante ?? false,
          };
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/point/[id] - Atualizar point
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões (apenas ADMIN pode atualizar points)
    if (usuario.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores podem atualizar estabelecimentos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    const body = await request.json();
    const { 
      nome, endereco, telefone, email, descricao, logoUrl, cardTemplateUrl, latitude, longitude, ativo,
      whatsappAccessToken, whatsappPhoneNumberId, whatsappBusinessAccountId, whatsappApiVersion, whatsappAtivo,
      gzappyApiKey, gzappyInstanceId, gzappyAtivo,
      enviarLembretesAgendamento, antecedenciaLembrete,
      infinitePayHandle
    } = body;

    if (!nome) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar point existente para verificar logo e template antigos
    const pointExistente = await query(
      `SELECT "logoUrl", "cardTemplateUrl" FROM "Point" WHERE id = $1`,
      [id]
    );

    // Processar logoUrl: se for base64, fazer upload para GCS
    let logoUrlProcessada: string | null | undefined = undefined;
    if (logoUrl !== undefined) {
      if (logoUrl === null) {
        // Se for null, deletar logo antigo se existir
        if (pointExistente.rows.length > 0 && pointExistente.rows[0].logoUrl) {
          const logoAntigo = pointExistente.rows[0].logoUrl;
          if (logoAntigo && logoAntigo.startsWith('https://storage.googleapis.com/')) {
            try {
              await deleteImage(logoAntigo);
            } catch (error) {
              console.error('Erro ao deletar logo antigo:', error);
            }
          }
        }
        logoUrlProcessada = null;
      } else if (logoUrl.startsWith('data:image/')) {
        // Se for base64, fazer upload
        try {
          const buffer = base64ToBuffer(logoUrl);
          const mimeMatch = logoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `point-logo-${id}-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'points');
          
          // Deletar logo antigo se existir
          if (pointExistente.rows.length > 0 && pointExistente.rows[0].logoUrl) {
            const logoAntigo = pointExistente.rows[0].logoUrl;
            if (logoAntigo && logoAntigo.startsWith('https://storage.googleapis.com/')) {
              try {
                await deleteImage(logoAntigo);
              } catch (error) {
                console.error('Erro ao deletar logo antigo:', error);
              }
            }
          }
          
          logoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload do logo:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload do logo' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // Se já for uma URL, manter como está
        logoUrlProcessada = logoUrl;
      } else {
        logoUrlProcessada = null;
      }
    }

    // Usar logoUrlProcessada se foi processado, senão usar logoUrl original ou manter o atual
    const logoUrlFinal = logoUrlProcessada !== undefined 
      ? logoUrlProcessada 
      : (logoUrl !== undefined ? logoUrl : (pointExistente.rows.length > 0 ? pointExistente.rows[0].logoUrl : null));

    // Processar cardTemplateUrl: se for base64, fazer upload para GCS
    let cardTemplateUrlProcessada: string | null | undefined = undefined;
    if (cardTemplateUrl !== undefined) {
      if (cardTemplateUrl === null) {
        // Se for null, deletar template antigo se existir
        if (pointExistente.rows.length > 0 && pointExistente.rows[0].cardTemplateUrl) {
          const templateAntigo = pointExistente.rows[0].cardTemplateUrl;
          if (templateAntigo && templateAntigo.startsWith('https://storage.googleapis.com/')) {
            try {
              await deleteImage(templateAntigo);
            } catch (error) {
              console.error('Erro ao deletar template antigo:', error);
            }
          }
        }
        cardTemplateUrlProcessada = null;
      } else if (cardTemplateUrl.startsWith('data:image/')) {
        // Se for base64, fazer upload
        try {
          const buffer = base64ToBuffer(cardTemplateUrl);
          const mimeMatch = cardTemplateUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'png';
          const fileName = `card-template-${id}-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'templates/cards');
          
          // Deletar template antigo se existir
          if (pointExistente.rows.length > 0 && pointExistente.rows[0].cardTemplateUrl) {
            const templateAntigo = pointExistente.rows[0].cardTemplateUrl;
            if (templateAntigo && templateAntigo.startsWith('https://storage.googleapis.com/')) {
              try {
                await deleteImage(templateAntigo);
              } catch (error) {
                console.error('Erro ao deletar template antigo:', error);
              }
            }
          }
          
          cardTemplateUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload do template de card:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload do template de card' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (cardTemplateUrl.startsWith('http://') || cardTemplateUrl.startsWith('https://')) {
        // Se já for uma URL, manter como está
        cardTemplateUrlProcessada = cardTemplateUrl;
      } else {
        cardTemplateUrlProcessada = null;
      }
    }

    // Usar cardTemplateUrlProcessada se foi processado, senão usar cardTemplateUrl original ou manter o atual
    const cardTemplateUrlFinal = cardTemplateUrlProcessada !== undefined 
      ? cardTemplateUrlProcessada 
      : (cardTemplateUrl !== undefined ? cardTemplateUrl : (pointExistente.rows.length > 0 ? pointExistente.rows[0].cardTemplateUrl : null));

    // Tentar primeiro com campos WhatsApp e Gzappy (se existirem)
    let result;
    try {
      result = await query(
        `UPDATE "Point"
         SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, "cardTemplateUrl" = $7, latitude = $8, longitude = $9, ativo = $10,
             "whatsappAccessToken" = $11, "whatsappPhoneNumberId" = $12, "whatsappBusinessAccountId" = $13, 
             "whatsappApiVersion" = $14, "whatsappAtivo" = $15,
             "gzappyApiKey" = $16, "gzappyInstanceId" = $17, "gzappyAtivo" = $18,
             "enviarLembretesAgendamento" = $19, "antecedenciaLembrete" = $20, 
             "infinitePayHandle" = $21, "updatedAt" = NOW()
         WHERE id = $22
         RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
                   "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
                   "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
                   "enviarLembretesAgendamento", "antecedenciaLembrete",
                   "infinitePayHandle",
                   "createdAt", "updatedAt"`,
        [
          nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
          cardTemplateUrlFinal, latitude || null, longitude || null, ativo ?? true,
          whatsappAccessToken || null, whatsappPhoneNumberId || null, whatsappBusinessAccountId || null,
          whatsappApiVersion || 'v21.0', whatsappAtivo ?? false,
          gzappyApiKey || null, gzappyInstanceId || null, gzappyAtivo ?? false,
          enviarLembretesAgendamento ?? false, antecedenciaLembrete || null,
          infinitePayHandle || null,
          id
        ]
      );
    } catch (error: any) {
      // Se falhar (colunas WhatsApp/Gzappy não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Campos WhatsApp/Gzappy não encontrados, atualizando sem eles');
        result = await query(
          `UPDATE "Point"
           SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, "cardTemplateUrl" = $7, latitude = $8, longitude = $9, ativo = $10, "updatedAt" = NOW()
           WHERE id = $11
           RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
                     "createdAt", "updatedAt"`,
          [
            nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
            cardTemplateUrlFinal, latitude || null, longitude || null, ativo ?? true,
            id
          ]
        );
        // Adicionar campos WhatsApp, Gzappy e Lembretes como null para compatibilidade
        if (result.rows.length > 0) {
          result.rows[0] = {
            ...result.rows[0],
            whatsappAccessToken: null,
            whatsappPhoneNumberId: null,
            whatsappBusinessAccountId: null,
            whatsappApiVersion: 'v21.0',
            whatsappAtivo: false,
            gzappyApiKey: null,
            gzappyInstanceId: null,
            gzappyAtivo: false,
            enviarLembretesAgendamento: false,
            antecedenciaLembrete: 8,
          };
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/point/[id] - Deletar point
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verificar se há quadras vinculadas
    const quadrasResult = await query(
      `SELECT COUNT(*) as count FROM "Quadra" WHERE "pointId" = $1`,
      [id]
    );

    if (parseInt(quadrasResult.rows[0].count) > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar estabelecimento com quadras vinculadas' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `DELETE FROM "Point" WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ mensagem: 'Estabelecimento deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  console.log('[CORS] OPTIONS request recebida para /api/point/[id]');
  const origin = request.headers.get('origin');
  console.log('[CORS] Origin:', origin);
  const response = withCors(new NextResponse(null, { status: 204 }), request);
  console.log('[CORS] Headers retornados:', Object.fromEntries(response.headers.entries()));
  return response;
}

