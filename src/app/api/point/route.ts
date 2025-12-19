// app/api/point/route.ts - Rotas de API para Points (CRUD completo)
// IMPORTANTE: Esta rota requer autenticação e expõe dados sensíveis (tokens WhatsApp)
// Para o frontend externo, use /api/point/public que não requer autenticação e não expõe dados sensíveis
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, base64ToBuffer } from '@/lib/googleCloudStorage';

// GET /api/point - Listar todos os points (requer autenticação)
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request); // Retorna erro 401
    }

    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get('apenasAtivos') === 'true';
    
    // Tentar primeiro com campos WhatsApp e Gzappy (se existirem)
    let result;
    try {
      const whereClause = apenasAtivos ? 'WHERE ativo = true' : '';
      result = await query(
        `SELECT 
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
          "enviarLembretesAgendamento", "antecedenciaLembrete",
          assinante, "createdAt", "updatedAt"
        FROM "Point"
        ${whereClause}
        ORDER BY nome ASC`
      );
    } catch (error: any) {
      // Se falhar (colunas WhatsApp/Gzappy não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Campos WhatsApp/Gzappy não encontrados, usando query sem eles');
        const whereClause = apenasAtivos ? 'WHERE ativo = true' : '';
        result = await query(
          `SELECT 
            id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
            assinante, "createdAt", "updatedAt"
          FROM "Point"
          ${whereClause}
          ORDER BY nome ASC`
        );
        // Adicionar campos WhatsApp, Gzappy e Lembretes como null para compatibilidade
        result.rows = result.rows.map((row: any) => ({
          ...row,
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
          assinante: row.assinante ?? false,
        }));
      } else {
        throw error;
      }
    }
    const response = NextResponse.json(result.rows);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar points:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar estabelecimentos', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/point - Criar novo point (requer autenticação)
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request); // Retorna erro 401
    }

    const body = await request.json();
    const { 
      nome, endereco, telefone, email, descricao, logoUrl, latitude, longitude, ativo = true,
      whatsappAccessToken, whatsappPhoneNumberId, whatsappBusinessAccountId, whatsappApiVersion, whatsappAtivo,
      gzappyApiKey, gzappyInstanceId, gzappyAtivo,
      enviarLembretesAgendamento, antecedenciaLembrete
    } = body;

    if (!nome) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Processar logoUrl: se for base64, fazer upload para GCS
    let logoUrlProcessada: string | null = null;
    if (logoUrl) {
      if (logoUrl.startsWith('data:image/')) {
        try {
          const buffer = base64ToBuffer(logoUrl);
          const mimeMatch = logoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `point-logo-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'points');
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

    // Tentar primeiro com campos WhatsApp e Gzappy (se existirem)
    let result;
    try {
      result = await query(
        `INSERT INTO "Point" (
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
          "enviarLembretesAgendamento", "antecedenciaLembrete",
          "createdAt", "updatedAt"
        )
         VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17,
          $18, $19,
          NOW(), NOW()
         )
         RETURNING 
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
          "enviarLembretesAgendamento", "antecedenciaLembrete",
          "createdAt", "updatedAt"`,
        [
          nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlProcessada, 
          latitude || null, longitude || null, ativo,
          whatsappAccessToken || null, whatsappPhoneNumberId || null, whatsappBusinessAccountId || null,
          whatsappApiVersion || 'v21.0', whatsappAtivo ?? false,
          gzappyApiKey || null, gzappyInstanceId || null, gzappyAtivo ?? false,
          enviarLembretesAgendamento ?? false, antecedenciaLembrete || null
        ]
      );
    } catch (error: any) {
      // Se falhar (colunas WhatsApp/Gzappy não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Campos WhatsApp/Gzappy não encontrados, criando sem eles');
        result = await query(
          `INSERT INTO "Point" (
            id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
            "createdAt", "updatedAt"
          )
           VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9,
            NOW(), NOW()
           )
           RETURNING 
            id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
            "createdAt", "updatedAt"`,
          [
            nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlProcessada, 
            latitude || null, longitude || null, ativo
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

    const response = NextResponse.json(result.rows[0], { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

