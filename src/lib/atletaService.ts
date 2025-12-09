// lib/atletaService.ts - Serviços de atleta
import { query } from './db';
import { v4 as uuidv4 } from 'uuid';

function calcularIdade(dataNascimento: Date | string): number {
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

export async function criarAtleta(usuarioId: string, dados: {
  nome: string;
  dataNascimento: string;
  categoria?: string | null;
  genero?: string | null;
  fone?: string | null;
  fotoUrl?: string | null;
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}) {
  const id = uuidv4();
  const dataNasc = new Date(dados.dataNascimento);
  
  await query(
    'INSERT INTO "Atleta" (id, nome, "dataNascimento", categoria, genero, fone, "fotoUrl", "usuarioId", "pointIdPrincipal", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())',
    [id, dados.nome, dataNasc, dados.categoria || null, dados.genero || null, dados.fone || null, dados.fotoUrl || null, usuarioId, dados.pointIdPrincipal || null]
  );
  
  // Inserir arenas frequentes
  if (dados.pointIdsFrequentes && dados.pointIdsFrequentes.length > 0) {
    try {
      for (const pointId of dados.pointIdsFrequentes) {
        await query(
          'INSERT INTO "AtletaPoint" ("atletaId", "pointId", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("atletaId", "pointId") DO NOTHING',
          [id, pointId]
        );
      }
    } catch (error: any) {
      console.warn('Erro ao inserir arenas frequentes (tabela pode não existir ainda):', error?.message);
      // Continua mesmo se houver erro - a tabela pode não existir ainda
    }
  }
  
  const atleta = await buscarAtletaComArenas(id);
  
  return {
    ...atleta,
    idade: calcularIdade(atleta.dataNascimento),
  };
}

export async function listarAtletas(usuario: { id: string; role: string; pointIdGestor?: string | null }) {
  let atletas: any[] = [];
  
  // ADMIN e ORGANIZER podem ver todos os atletas
  // ORGANIZER pode ver todos os atletas para poder agendar para qualquer um na sua arena
  if (usuario.role === "ADMIN" || usuario.role === "ORGANIZER") {
    const result = await query(
      `SELECT DISTINCT a.*, u.id as "usuarioId", u.name as "usuarioName", u.email as "usuarioEmail", u.role as "usuarioRole" 
       FROM "Atleta" a 
       LEFT JOIN "User" u ON a."usuarioId" = u.id 
       ORDER BY a.nome ASC`,
      []
    );
    
    atletas = result.rows.map((row: any) => ({
      ...row,
      usuarioId: row.usuarioId || null,
      usuario: row.usuarioName ? { 
        id: row.usuarioId,
        name: row.usuarioName, 
        email: row.usuarioEmail || null,
        role: row.usuarioRole 
      } : null,
      idade: calcularIdade(row.dataNascimento),
    }));
  } else {
    // USER comum vê apenas seus próprios atletas
    const result = await query(
      `SELECT a.*, u.id as "usuarioId", u.name as "usuarioName", u.email as "usuarioEmail", u.role as "usuarioRole" 
       FROM "Atleta" a 
       LEFT JOIN "User" u ON a."usuarioId" = u.id 
       WHERE a."usuarioId" = $1
       ORDER BY a.nome ASC`,
      [usuario.id]
    );
    
    atletas = result.rows.map((row: any) => ({
      ...row,
      usuarioId: row.usuarioId || null,
      usuario: row.usuarioName ? { 
        id: row.usuarioId,
        name: row.usuarioName, 
        email: row.usuarioEmail || null,
        role: row.usuarioRole 
      } : null,
      idade: calcularIdade(row.dataNascimento),
    }));
  }

  // Carregar arenas para cada atleta
  const atletasComArenas = await Promise.all(
    atletas.map(async (atleta) => {
      try {
        const atletaComArenas = await buscarAtletaComArenas(atleta.id);
        return atletaComArenas || atleta;
      } catch (error: any) {
        console.warn(`Erro ao buscar arenas do atleta ${atleta.id}:`, error?.message);
        // Retorna o atleta sem arenas em caso de erro
        return {
          ...atleta,
          arenasFrequentes: [],
          arenaPrincipal: null,
        };
      }
    })
  );

  return {
    atletas: atletasComArenas,
    usuario: { id: usuario.id, role: usuario.role },
  };
}

export async function listarAtletasPaginados(busca: string = "", pagina: number = 1, limite: number = 10) {
  const offset = (pagina - 1) * limite;
  const result = await query(
    `SELECT id, nome, "dataNascimento" 
     FROM "Atleta" 
     WHERE nome ILIKE $1 
     ORDER BY nome ASC 
     LIMIT $2 OFFSET $3`,
    [`%${busca}%`, limite, offset]
  );
  
  const atletas = result.rows.map((a: any) => ({
    ...a,
    idade: calcularIdade(a.dataNascimento),
  }));

  return atletas;
}

export async function verificarAtletaUsuario(usuarioId: string) {
  try {
    const result = await query(
      `SELECT a.*, u.name as "usuarioName", u.role as "usuarioRole" 
      FROM "Atleta" a 
      LEFT JOIN "User" u ON a."usuarioId" = u.id 
      WHERE a."usuarioId" = $1`,
      [usuarioId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const atletaId = result.rows[0].id;
    const atletaComArenas = await buscarAtletaComArenas(atletaId);
    return atletaComArenas;
  } catch (error: any) {
    console.error('Erro ao verificar atleta do usuário:', error);
    throw error; // Re-lança o erro para ser tratado pela API
  }
}

export async function buscarAtletaComArenas(atletaId: string) {
  const result = await query(
    `SELECT a.*, u.name as "usuarioName", u.role as "usuarioRole" 
     FROM "Atleta" a 
     LEFT JOIN "User" u ON a."usuarioId" = u.id 
     WHERE a.id = $1`,
    [atletaId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const atleta = result.rows[0];
  
  // Buscar arenas frequentes (com tratamento de erro caso a tabela não exista)
  let arenasFrequentes: any[] = [];
  try {
    const arenasFrequentesResult = await query(
      `SELECT p.id, p.nome, p."logoUrl"
       FROM "AtletaPoint" ap
       JOIN "Point" p ON ap."pointId" = p.id
       WHERE ap."atletaId" = $1
       ORDER BY p.nome ASC`,
      [atletaId]
    );
    arenasFrequentes = arenasFrequentesResult.rows;
  } catch (error: any) {
    // Se a tabela não existir ou houver erro, retorna array vazio
    console.warn('Erro ao buscar arenas frequentes (tabela pode não existir ainda):', error?.message);
    arenasFrequentes = [];
  }
  
  // Buscar arena principal
  let arenaPrincipal = null;
  if (atleta.pointIdPrincipal) {
    try {
      const arenaPrincipalResult = await query(
        `SELECT id, nome, "logoUrl" FROM "Point" WHERE id = $1`,
        [atleta.pointIdPrincipal]
      );
      if (arenaPrincipalResult.rows.length > 0) {
        arenaPrincipal = arenaPrincipalResult.rows[0];
      }
    } catch (error: any) {
      console.warn('Erro ao buscar arena principal:', error?.message);
      arenaPrincipal = null;
    }
  }
  
  return {
    ...atleta,
    usuario: atleta.usuarioName ? { name: atleta.usuarioName, role: atleta.usuarioRole } : null,
    idade: calcularIdade(atleta.dataNascimento),
    arenasFrequentes,
    arenaPrincipal,
  };
}

export async function buscarAtletaPorId(atletaId: string) {
  return buscarAtletaComArenas(atletaId);
}

export async function atualizarAtleta(atletaId: string, dados: {
  nome?: string;
  dataNascimento?: string;
  categoria?: string | null;
  genero?: string | null;
  fone?: string | null;
  fotoUrl?: string | null;
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}) {
  const campos: string[] = [];
  const valores: any[] = [];
  let paramIndex = 1;

  if (dados.nome !== undefined) {
    campos.push(`nome = $${paramIndex++}`);
    valores.push(dados.nome);
  }
  if (dados.dataNascimento !== undefined) {
    campos.push(`"dataNascimento" = $${paramIndex++}`);
    valores.push(new Date(dados.dataNascimento));
  }
  if (dados.categoria !== undefined) {
    campos.push(`categoria = $${paramIndex++}`);
    valores.push(dados.categoria || null);
  }
  if (dados.genero !== undefined) {
    campos.push(`genero = $${paramIndex++}`);
    valores.push(dados.genero || null);
  }
  if (dados.fone !== undefined) {
    campos.push(`fone = $${paramIndex++}`);
    valores.push(dados.fone || null);
  }
  if (dados.fotoUrl !== undefined) {
    campos.push(`"fotoUrl" = $${paramIndex++}`);
    valores.push(dados.fotoUrl || null);
  }
  if (dados.pointIdPrincipal !== undefined) {
    campos.push(`"pointIdPrincipal" = $${paramIndex++}`);
    valores.push(dados.pointIdPrincipal || null);
  }

  if (campos.length > 0) {
    campos.push(`"updatedAt" = NOW()`);
    valores.push(atletaId);

    const queryStr = `UPDATE "Atleta" SET ${campos.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    await query(queryStr, valores);
  }

  // Atualizar arenas frequentes se fornecido
  if (dados.pointIdsFrequentes !== undefined) {
    try {
      // Remover todas as arenas frequentes existentes
      await query('DELETE FROM "AtletaPoint" WHERE "atletaId" = $1', [atletaId]);
      
      // Inserir novas arenas frequentes
      if (dados.pointIdsFrequentes.length > 0) {
        for (const pointId of dados.pointIdsFrequentes) {
          await query(
            'INSERT INTO "AtletaPoint" ("atletaId", "pointId", "createdAt") VALUES ($1, $2, NOW())',
            [atletaId, pointId]
          );
        }
      }
    } catch (error: any) {
      console.warn('Erro ao atualizar arenas frequentes (tabela pode não existir ainda):', error?.message);
      // Continua mesmo se houver erro - a tabela pode não existir ainda
    }
  }

  const atleta = await buscarAtletaComArenas(atletaId);
  
  if (!atleta) {
    return null;
  }

  return {
    ...atleta,
    idade: calcularIdade(atleta.dataNascimento),
  };
}



