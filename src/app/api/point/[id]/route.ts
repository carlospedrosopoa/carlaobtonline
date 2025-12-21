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
    // Tentar primeiro com campos WhatsApp e Gzappy (se existirem)
    let result;
    try {
      result = await query(
        `SELECT 
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
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
      // Se falhar (colunas WhatsApp/Gzappy não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Campos WhatsApp/Gzappy não encontrados, usando query sem eles');
        result = await query(
          `SELECT 
            id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
            assinante, "createdAt", "updatedAt"
          FROM "Point"
          WHERE id = $1`,
          [id]
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
    const { id } = await params;
    const body = await request.json();
    const { 
      nome, endereco, telefone, email, descricao, logoUrl, latitude, longitude, ativo,
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

    // Buscar point existente para verificar logo antigo
    const pointExistente = await query(
      `SELECT "logoUrl" FROM "Point" WHERE id = $1`,
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

    // Tentar primeiro com campos WhatsApp e Gzappy (se existirem)
    let result;
    try {
      result = await query(
        `UPDATE "Point"
         SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, latitude = $7, longitude = $8, ativo = $9,
             "whatsappAccessToken" = $10, "whatsappPhoneNumberId" = $11, "whatsappBusinessAccountId" = $12, 
             "whatsappApiVersion" = $13, "whatsappAtivo" = $14,
             "gzappyApiKey" = $15, "gzappyInstanceId" = $16, "gzappyAtivo" = $17,
             "enviarLembretesAgendamento" = $18, "antecedenciaLembrete" = $19, 
             "infinitePayHandle" = $20, "updatedAt" = NOW()
         WHERE id = $21
         RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
                   "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
                   "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
                   "enviarLembretesAgendamento", "antecedenciaLembrete",
                   "infinitePayHandle",
                   "createdAt", "updatedAt"`,
        [
          nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
          latitude || null, longitude || null, ativo ?? true,
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
           SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, latitude = $7, longitude = $8, ativo = $9, "updatedAt" = NOW()
           WHERE id = $10
           RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
                     "createdAt", "updatedAt"`,
          [
            nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
            latitude || null, longitude || null, ativo ?? true,
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
  return withCors(new NextResponse(null, { status: 204 }), request);
}

