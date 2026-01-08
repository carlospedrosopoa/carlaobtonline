// app/api/public/point/[id]/esportes/route.ts
// API pública para buscar esportes disponíveis em uma arena
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// GET /api/public/point/[id]/esportes - Obter esportes disponíveis na arena
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Buscar todas as quadras ativas da arena com seus tipos de esporte
    const result = await query(
      `SELECT "tiposEsporte" 
       FROM "Quadra"
       WHERE "pointId" = $1 AND ativo = true AND "tiposEsporte" IS NOT NULL`,
      [id]
    );

    // Coletar todos os esportes únicos
    const esportesSet = new Set<string>();
    
    for (const row of result.rows) {
      if (row.tiposEsporte) {
        let tiposEsporteArray: string[] = [];
        
        // Parse do JSON se for string
        if (Array.isArray(row.tiposEsporte)) {
          tiposEsporteArray = row.tiposEsporte;
        } else if (typeof row.tiposEsporte === 'string') {
          try {
            tiposEsporteArray = JSON.parse(row.tiposEsporte);
          } catch (e) {
            // Ignorar erros de parse
            continue;
          }
        }
        
        // Adicionar cada esporte ao Set
        tiposEsporteArray.forEach((esporte: string) => {
          if (esporte && esporte.trim()) {
            esportesSet.add(esporte.trim());
          }
        });
      }
    }

    // Converter para array e ordenar alfabeticamente
    const esportes = Array.from(esportesSet).sort((a, b) => 
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );

    return withCors(NextResponse.json({ esportes }), request);
  } catch (error: any) {
    console.error('Erro ao obter esportes da arena:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao obter esportes da arena', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

