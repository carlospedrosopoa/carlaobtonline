// app/api/competicao/route.ts - Rotas de API para Competições
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, base64ToBuffer } from '@/lib/googleCloudStorage';
import type { CriarCompeticaoPayload } from '@/types/competicao';

// GET /api/competicao - Listar competições
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pointId = searchParams.get('pointId');
    const status = searchParams.get('status');
    const tipo = searchParams.get('tipo');

    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    let sql = `SELECT 
      c.id, c."pointId", c."quadraId", c.nome, c.tipo, c.formato, c.status,
      c."dataInicio", c."dataFim", c.descricao, c."valorInscricao", c.premio, 
      c.regras, c."cardDivulgacaoUrl", c."fotoCompeticaoUrl", c."configSuper8", c."createdAt", c."updatedAt", c."createdById", c."updatedById",
      p.id as "point_id", p.nome as "point_nome",
      q.id as "quadra_id", q.nome as "quadra_nome"
    FROM "Competicao" c
    LEFT JOIN "Point" p ON c."pointId" = p.id
    LEFT JOIN "Quadra" q ON c."quadraId" = q.id
    WHERE 1=1`;

    const params: any[] = [];
    let paramCount = 1;

    // Se for ORGANIZER, filtrar apenas competições da sua arena
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
      sql += ` AND c."pointId" = $${paramCount}`;
      params.push(usuario.pointIdGestor);
      paramCount++;
    } else if (pointId) {
      sql += ` AND c."pointId" = $${paramCount}`;
      params.push(pointId);
      paramCount++;
    }

    if (status) {
      sql += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (tipo) {
      sql += ` AND c.tipo = $${paramCount}`;
      params.push(tipo);
      paramCount++;
    }

    sql += ` ORDER BY c."createdAt" DESC`;

    const result = await query(sql, params);

    const competicoes = result.rows.map((row) => ({
      id: row.id,
      pointId: row.pointId,
      quadraId: row.quadraId || null,
      nome: row.nome,
      tipo: row.tipo,
      formato: row.formato,
      status: row.status,
      dataInicio: row.dataInicio ? new Date(row.dataInicio).toISOString() : null,
      dataFim: row.dataFim ? new Date(row.dataFim).toISOString() : null,
      descricao: row.descricao || null,
      valorInscricao: row.valorInscricao ? parseFloat(row.valorInscricao) : null,
      premio: row.premio || null,
      regras: row.regras || null,
      cardDivulgacaoUrl: row.cardDivulgacaoUrl || null,
      fotoCompeticaoUrl: row.fotoCompeticaoUrl || null,
      configSuper8: row.configSuper8 || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
      } : null,
    }));

    const response = NextResponse.json(competicoes);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao listar competições:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao listar competições', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// POST /api/competicao - Criar competição
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Apenas ADMIN e ORGANIZER podem criar competições
    if (usuario.role !== 'ADMIN' && usuario.role !== 'ORGANIZER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Apenas administradores e gestores podem criar competições.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body: CriarCompeticaoPayload = await request.json();
    const { pointId, quadraId, nome, tipo, formato, dataInicio, dataFim, descricao, valorInscricao, premio, regras, cardDivulgacaoUrl, fotoCompeticaoUrl, configSuper8 } = body;

    // Processar cardDivulgacaoUrl: se for base64, fazer upload para GCS
    let cardDivulgacaoUrlProcessada: string | null = null;
    if (cardDivulgacaoUrl) {
      if (cardDivulgacaoUrl.startsWith('data:image/')) {
        try {
          const buffer = base64ToBuffer(cardDivulgacaoUrl);
          const mimeMatch = cardDivulgacaoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `competicao-card-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'competicoes');
          cardDivulgacaoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload do card de divulgação:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload do card de divulgação' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (cardDivulgacaoUrl.startsWith('http://') || cardDivulgacaoUrl.startsWith('https://')) {
        cardDivulgacaoUrlProcessada = cardDivulgacaoUrl;
      }
    }

    // Processar fotoCompeticaoUrl: se for base64, fazer upload para GCS
    let fotoCompeticaoUrlProcessada: string | null = null;
    if (fotoCompeticaoUrl) {
      if (fotoCompeticaoUrl.startsWith('data:image/')) {
        try {
          const buffer = base64ToBuffer(fotoCompeticaoUrl);
          const mimeMatch = fotoCompeticaoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `competicao-foto-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'competicoes');
          fotoCompeticaoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload da foto da competição:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload da foto da competição' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (fotoCompeticaoUrl.startsWith('http://') || fotoCompeticaoUrl.startsWith('https://')) {
        fotoCompeticaoUrlProcessada = fotoCompeticaoUrl;
      }
    }

    if (!pointId || !nome || !tipo || !formato) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Campos obrigatórios: pointId, nome, tipo, formato' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Se for ORGANIZER, verificar se pointId pertence a ele
    if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor !== pointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Acesso negado. Você só pode criar competições na sua arena.' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `INSERT INTO "Competicao" (
        id, "pointId", "quadraId", nome, tipo, formato, status,
        "dataInicio", "dataFim", descricao, "valorInscricao", premio, regras, "cardDivulgacaoUrl", "fotoCompeticaoUrl", "configSuper8",
        "createdAt", "updatedAt", "createdById"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, 'CRIADA',
        $6, $7, $8, $9, $10, $11, $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING id`,
      [
        pointId,
        quadraId || null,
        nome,
        tipo,
        formato,
        dataInicio ? new Date(dataInicio).toISOString() : null,
        dataFim ? new Date(dataFim).toISOString() : null,
        descricao || null,
        valorInscricao || null,
        premio || null,
        regras || null,
        cardDivulgacaoUrlProcessada,
        fotoCompeticaoUrlProcessada,
        configSuper8 ? JSON.stringify(configSuper8) : null,
        usuario.id,
      ]
    );

    const competicaoId = result.rows[0].id;

    // Buscar competição criada
      const competicaoResult = await query(
      `SELECT 
        c.id, c."pointId", c."quadraId", c.nome, c.tipo, c.formato, c.status,
        c."dataInicio", c."dataFim", c.descricao, c."valorInscricao", c.premio, 
        c.regras, c."cardDivulgacaoUrl", c."fotoCompeticaoUrl", c."configSuper8", c."createdAt", c."updatedAt",
        p.id as "point_id", p.nome as "point_nome",
        q.id as "quadra_id", q.nome as "quadra_nome"
      FROM "Competicao" c
      LEFT JOIN "Point" p ON c."pointId" = p.id
      LEFT JOIN "Quadra" q ON c."quadraId" = q.id
      WHERE c.id = $1`,
      [competicaoId]
    );

    const row = competicaoResult.rows[0];
    const competicao = {
      id: row.id,
      pointId: row.pointId,
      quadraId: row.quadraId || null,
      nome: row.nome,
      tipo: row.tipo,
      formato: row.formato,
      status: row.status,
      dataInicio: row.dataInicio ? new Date(row.dataInicio).toISOString() : null,
      dataFim: row.dataFim ? new Date(row.dataFim).toISOString() : null,
      descricao: row.descricao || null,
      valorInscricao: row.valorInscricao ? parseFloat(row.valorInscricao) : null,
      premio: row.premio || null,
      regras: row.regras || null,
      cardDivulgacaoUrl: row.cardDivulgacaoUrl || null,
      fotoCompeticaoUrl: row.fotoCompeticaoUrl || null,
      configSuper8: row.configSuper8 || null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      point: row.point_id ? {
        id: row.point_id,
        nome: row.point_nome,
      } : null,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
      } : null,
    };

    const response = NextResponse.json(competicao, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao criar competição:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao criar competição', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}


