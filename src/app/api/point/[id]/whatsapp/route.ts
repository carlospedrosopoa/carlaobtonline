// app/api/point/[id]/whatsapp/route.ts - Configurações WhatsApp de um Point
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';

/**
 * GET /api/point/[id]/whatsapp
 * Obter configurações WhatsApp de um point (sem expor o token completo por segurança)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar permissões
    if (usuario.role !== 'ADMIN' && (usuario.role !== 'ORGANIZER' || usuario.pointIdGestor !== id)) {
      return NextResponse.json(
        { mensagem: 'Sem permissão para acessar esta configuração' },
        { status: 403 }
      );
    }

    const result = await query(
      `SELECT 
        "whatsappPhoneNumberId",
        "whatsappBusinessAccountId",
        "whatsappApiVersion",
        "whatsappAtivo",
        CASE 
          WHEN "whatsappAccessToken" IS NOT NULL THEN '***' || RIGHT("whatsappAccessToken", 4)
          ELSE NULL
        END as "whatsappAccessTokenMasked"
      FROM "Point"
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Erro ao obter configurações WhatsApp:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao obter configurações WhatsApp', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/point/[id]/whatsapp
 * Atualizar configurações WhatsApp de um point
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      return NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar permissões
    if (usuario.role !== 'ADMIN' && (usuario.role !== 'ORGANIZER' || usuario.pointIdGestor !== id)) {
      return NextResponse.json(
        { mensagem: 'Sem permissão para atualizar esta configuração' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      whatsappAccessToken,
      whatsappPhoneNumberId,
      whatsappBusinessAccountId,
      whatsappApiVersion,
      whatsappAtivo,
    } = body;

    // Validações
    if (whatsappAtivo === true) {
      if (!whatsappAccessToken || !whatsappPhoneNumberId) {
        return NextResponse.json(
          { mensagem: 'Access Token e Phone Number ID são obrigatórios para ativar o WhatsApp' },
          { status: 400 }
        );
      }
    }

    // Buscar configurações atuais para preservar valores não fornecidos
    const currentResult = await query(
      `SELECT "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo"
       FROM "Point" WHERE id = $1`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
    }

    const current = currentResult.rows[0];

    // Se não forneceu o token completo, manter o atual (para atualizações parciais)
    const finalAccessToken = whatsappAccessToken !== undefined 
      ? whatsappAccessToken 
      : current.whatsappAccessToken;

    const result = await query(
      `UPDATE "Point"
       SET "whatsappAccessToken" = $1,
           "whatsappPhoneNumberId" = COALESCE($2, "whatsappPhoneNumberId"),
           "whatsappBusinessAccountId" = COALESCE($3, "whatsappBusinessAccountId"),
           "whatsappApiVersion" = COALESCE($4, "whatsappApiVersion", 'v21.0'),
           "whatsappAtivo" = COALESCE($5, "whatsappAtivo", false),
           "updatedAt" = NOW()
       WHERE id = $6
       RETURNING 
         "whatsappPhoneNumberId",
         "whatsappBusinessAccountId",
         "whatsappApiVersion",
         "whatsappAtivo",
         CASE 
           WHEN "whatsappAccessToken" IS NOT NULL THEN '***' || RIGHT("whatsappAccessToken", 4)
           ELSE NULL
         END as "whatsappAccessTokenMasked"`,
      [
        finalAccessToken,
        whatsappPhoneNumberId !== undefined ? whatsappPhoneNumberId : null,
        whatsappBusinessAccountId !== undefined ? whatsappBusinessAccountId : null,
        whatsappApiVersion !== undefined ? whatsappApiVersion : null,
        whatsappAtivo !== undefined ? whatsappAtivo : null,
        id,
      ]
    );

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Configurações WhatsApp atualizadas com sucesso',
      dados: result.rows[0],
    });
  } catch (error: any) {
    console.error('Erro ao atualizar configurações WhatsApp:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao atualizar configurações WhatsApp', error: error.message },
      { status: 500 }
    );
  }
}

