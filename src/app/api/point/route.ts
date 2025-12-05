// app/api/point/route.ts - Rotas de API para Points (CRUD completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/point - Listar todos os points
export async function GET(request: NextRequest) {
  try {
    // Tentar primeiro com campos WhatsApp (se existirem)
    let result;
    try {
      result = await query(
        `SELECT 
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "createdAt", "updatedAt"
        FROM "Point"
        ORDER BY nome ASC`
      );
    } catch (error: any) {
      // Se falhar (colunas WhatsApp não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Campos WhatsApp não encontrados, usando query sem eles');
        result = await query(
          `SELECT 
            id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
            "createdAt", "updatedAt"
          FROM "Point"
          ORDER BY nome ASC`
        );
        // Adicionar campos WhatsApp como null para compatibilidade
        result.rows = result.rows.map((row: any) => ({
          ...row,
          whatsappAccessToken: null,
          whatsappPhoneNumberId: null,
          whatsappBusinessAccountId: null,
          whatsappApiVersion: 'v21.0',
          whatsappAtivo: false,
        }));
      } else {
        throw error;
      }
    }
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Erro ao listar points:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao listar estabelecimentos', error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/point - Criar novo point
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nome, endereco, telefone, email, descricao, logoUrl, latitude, longitude, ativo = true,
      whatsappAccessToken, whatsappPhoneNumberId, whatsappBusinessAccountId, whatsappApiVersion, whatsappAtivo
    } = body;

    if (!nome) {
      return NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // Tentar primeiro com campos WhatsApp (se existirem)
    let result;
    try {
      result = await query(
        `INSERT INTO "Point" (
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "createdAt", "updatedAt"
        )
         VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          NOW(), NOW()
         )
         RETURNING 
          id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "createdAt", "updatedAt"`,
        [
          nome, endereco || null, telefone || null, email || null, descricao || null, logoUrl || null, 
          latitude || null, longitude || null, ativo,
          whatsappAccessToken || null, whatsappPhoneNumberId || null, whatsappBusinessAccountId || null,
          whatsappApiVersion || 'v21.0', whatsappAtivo ?? false
        ]
      );
    } catch (error: any) {
      // Se falhar (colunas WhatsApp não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Campos WhatsApp não encontrados, criando sem eles');
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
            nome, endereco || null, telefone || null, email || null, descricao || null, logoUrl || null, 
            latitude || null, longitude || null, ativo
          ]
        );
        // Adicionar campos WhatsApp como null para compatibilidade
        if (result.rows.length > 0) {
          result.rows[0] = {
            ...result.rows[0],
            whatsappAccessToken: null,
            whatsappPhoneNumberId: null,
            whatsappBusinessAccountId: null,
            whatsappApiVersion: 'v21.0',
            whatsappAtivo: false,
          };
        }
      } else {
        throw error;
      }
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar point:', error);
    return NextResponse.json(
      { mensagem: 'Erro ao criar estabelecimento', error: error.message },
      { status: 500 }
    );
  }
}

