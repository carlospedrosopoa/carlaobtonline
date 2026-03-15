import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query, transaction } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

type ImportarCompeticoesBody = {
  sourcePointId: string;
  targetPointId: string;
  competicaoIds: string[];
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;

    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
      return withCors(errorResponse, request);
    }

    const body: ImportarCompeticoesBody = await request.json().catch(() => ({} as any));
    const sourcePointId = String(body?.sourcePointId || '');
    const targetPointId = String(body?.targetPointId || '');
    const competicaoIds = Array.isArray(body?.competicaoIds) ? body.competicaoIds.filter(Boolean) : [];

    if (!sourcePointId || !targetPointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'sourcePointId e targetPointId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (sourcePointId === targetPointId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'A arena de origem e destino devem ser diferentes' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (competicaoIds.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Selecione ao menos uma competição para importar' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const pontos = await query(
      `SELECT id FROM "Point" WHERE id IN ($1, $2)`,
      [sourcePointId, targetPointId]
    );
    if (pontos.rows.length !== 2) {
      const errorResponse = NextResponse.json({ mensagem: 'Point de origem ou destino não encontrado' }, { status: 404 });
      return withCors(errorResponse, request);
    }

    const result = await transaction(async (client) => {
      const runQuery = (text: string, params?: any[]) => client.query(text, params);

      const competicoesOrigem = await runQuery(
        `SELECT *
         FROM "Competicao"
         WHERE "pointId" = $1
           AND id = ANY($2::text[])
         ORDER BY "createdAt" ASC`,
        [sourcePointId, competicaoIds]
      );

      if (competicoesOrigem.rows.length === 0) {
        throw new Error('Nenhuma competição encontrada para importar');
      }

      const quadraIds = new Set<string>();
      for (const c of competicoesOrigem.rows) {
        if (c.quadraId) quadraIds.add(String(c.quadraId));
      }

      const jogosOrigem = await runQuery(
        `SELECT *
         FROM "JogoCompeticao"
         WHERE "competicaoId" = ANY($1::text[])
         ORDER BY "createdAt" ASC, "numeroJogo" ASC`,
        [competicaoIds]
      );

      for (const j of jogosOrigem.rows) {
        if (j.quadraId) quadraIds.add(String(j.quadraId));
      }

      const quadraIdPermitida = new Set<string>();
      if (quadraIds.size > 0) {
        const quadrasDestino = await runQuery(
          `SELECT id FROM "Quadra" WHERE "pointId" = $1 AND id = ANY($2::text[])`,
          [targetPointId, Array.from(quadraIds)]
        );
        for (const q of quadrasDestino.rows) quadraIdPermitida.add(String(q.id));
      }

      const atletasCompeticaoOrigem = await runQuery(
        `SELECT *
         FROM "AtletaCompeticao"
         WHERE "competicaoId" = ANY($1::text[])
         ORDER BY "createdAt" ASC`,
        [competicaoIds]
      );

      const competicaoIdMap = new Map<string, string>();
      let competicoesImportadas = 0;
      let competicoesIgnoradas = 0;
      let jogosImportados = 0;
      let atletasCompeticaoImportados = 0;

      for (const c of competicoesOrigem.rows) {
        const exists = await runQuery(
          `SELECT id
           FROM "Competicao"
           WHERE "pointId" = $1
             AND nome = $2
           LIMIT 1`,
          [targetPointId, c.nome]
        );

        if (exists.rows[0]?.id) {
          competicoesIgnoradas++;
          continue;
        }

        const newCompeticaoId = uuidv4();
        competicaoIdMap.set(String(c.id), newCompeticaoId);

        const quadraIdDestino = c.quadraId && quadraIdPermitida.has(String(c.quadraId)) ? String(c.quadraId) : null;

        await runQuery(
          `INSERT INTO "Competicao" (
            id, "pointId", "quadraId", nome, tipo, formato, status,
            "dataInicio", "dataFim", descricao, "valorInscricao", premio, regras,
            "configSuper8", "createdAt", "updatedAt", "cardDivulgacaoUrl", "fotoCompeticaoUrl",
            "createdById", "updatedById"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,
            $19,$20
          )`,
          [
            newCompeticaoId,
            targetPointId,
            quadraIdDestino,
            c.nome,
            c.tipo,
            c.formato,
            c.status,
            c.dataInicio ?? null,
            c.dataFim ?? null,
            c.descricao ?? null,
            c.valorInscricao ?? null,
            c.premio ?? null,
            c.regras ?? null,
            c.configSuper8 ?? null,
            c.createdAt ?? new Date(),
            c.updatedAt ?? new Date(),
            c.cardDivulgacaoUrl ?? null,
            c.fotoCompeticaoUrl ?? null,
            c.createdById ?? null,
            c.updatedById ?? null,
          ]
        );

        competicoesImportadas++;
      }

      for (const j of jogosOrigem.rows) {
        const newCompeticaoId = competicaoIdMap.get(String(j.competicaoId));
        if (!newCompeticaoId) continue;

        const quadraIdDestino = j.quadraId && quadraIdPermitida.has(String(j.quadraId)) ? String(j.quadraId) : null;

        await runQuery(
          `INSERT INTO "JogoCompeticao" (
            id, "competicaoId", rodada, "numeroJogo",
            "atleta1Id", "atleta2Id", "atleta3Id", "atleta4Id",
            "atleta1ParceriaId", "atleta2ParceriaId", "vencedorId",
            "pontosAtleta1", "pontosAtleta2", "gamesAtleta1", "gamesAtleta2",
            "tiebreakAtleta1", "tiebreakAtleta2", "dataHora", "quadraId",
            status, observacoes, "createdAt", "updatedAt", "createdById", "updatedById"
          ) VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,$8,
            $9,$10,$11,
            $12,$13,$14,$15,
            $16,$17,$18,$19,
            $20,$21,$22,$23,$24,$25
          )`,
          [
            uuidv4(),
            newCompeticaoId,
            j.rodada,
            j.numeroJogo,
            j.atleta1Id ?? null,
            j.atleta2Id ?? null,
            j.atleta3Id ?? null,
            j.atleta4Id ?? null,
            j.atleta1ParceriaId ?? null,
            j.atleta2ParceriaId ?? null,
            j.vencedorId ?? null,
            j.pontosAtleta1 ?? 0,
            j.pontosAtleta2 ?? 0,
            j.gamesAtleta1 ?? null,
            j.gamesAtleta2 ?? null,
            j.tiebreakAtleta1 ?? null,
            j.tiebreakAtleta2 ?? null,
            j.dataHora ?? null,
            quadraIdDestino,
            j.status ?? 'AGENDADO',
            j.observacoes ?? null,
            j.createdAt ?? new Date(),
            j.updatedAt ?? new Date(),
            j.createdById ?? null,
            j.updatedById ?? null,
          ]
        );

        jogosImportados++;
      }

      for (const ac of atletasCompeticaoOrigem.rows) {
        const newCompeticaoId = competicaoIdMap.get(String(ac.competicaoId));
        if (!newCompeticaoId) continue;

        await runQuery(
          `INSERT INTO "AtletaCompeticao" (
            id, "competicaoId", "atletaId", "parceriaId", "parceiroAtletaId",
            "posicaoFinal", pontos, "createdAt", "updatedAt", "createdById", "updatedById"
          ) VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10,$11
          )`,
          [
            uuidv4(),
            newCompeticaoId,
            ac.atletaId,
            ac.parceriaId ?? null,
            ac.parceiroAtletaId ?? null,
            ac.posicaoFinal ?? null,
            ac.pontos ?? 0,
            ac.createdAt ?? new Date(),
            ac.updatedAt ?? new Date(),
            ac.createdById ?? null,
            ac.updatedById ?? null,
          ]
        );

        atletasCompeticaoImportados++;
      }

      return {
        competicoesSelecionadas: competicaoIds.length,
        competicoesImportadas,
        competicoesIgnoradas,
        jogosImportados,
        atletasCompeticaoImportados,
      };
    });

    const response = NextResponse.json(result, { status: 201 });
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao importar competições', error: error?.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

