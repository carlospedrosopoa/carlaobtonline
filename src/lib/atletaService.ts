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
  esportePreferido?: string | null;
  esportesPratica?: string[];
  pointIdPrincipal?: string | null;
  pointIdsFrequentes?: string[];
}) {
  const id = uuidv4();
  const dataNasc = new Date(dados.dataNascimento);
  const esportesPraticaJson = dados.esportesPratica && Array.isArray(dados.esportesPratica) && dados.esportesPratica.length > 0
    ? JSON.stringify(dados.esportesPratica)
    : null;
  
  await query(
    'INSERT INTO "Atleta" (id, nome, "dataNascimento", categoria, genero, fone, "fotoUrl", "usuarioId", "esportePreferido", "esportesPratica", "pointIdPrincipal", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())',
    [id, dados.nome, dataNasc, dados.categoria || null, dados.genero || null, dados.fone || null, dados.fotoUrl || null, usuarioId, dados.esportePreferido || null, esportesPraticaJson, dados.pointIdPrincipal || null]
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

export async function listarAtletas(usuario: { id: string; role: string; pointIdGestor?: string | null }, busca: string = "") {
  let atletas: any[] = [];
  
  // Normalizar busca removendo acentuação e caracteres especiais
  const buscaNormalizada = busca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  
  // Para busca de telefone, remover também caracteres especiais
  const buscaTelefone = buscaNormalizada.replace(/[^\d]/g, '');
  
  const parametroBusca = buscaNormalizada ? `%${buscaNormalizada}%` : null;
  const parametroBuscaTelefone = buscaTelefone ? `%${buscaTelefone}%` : null;
  
  // ADMIN vê todos os atletas
  if (usuario.role === "ADMIN") {
    // Usar o mesmo padrão de cards de clientes: underscore nos aliases
    // Remover DISTINCT para evitar problemas com campos do JOIN
    let querySQL = `SELECT a.*, 
              u.id as "usuario_id", 
              u.name as "usuario_name", 
              u.email as "usuario_email", 
              u.role as "usuario_role" 
       FROM "Atleta" a 
       LEFT JOIN "User" u ON a."usuarioId" = u.id`;
    
    const params: any[] = [];
    
    if (parametroBusca) {
      querySQL += ` WHERE (
         LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE $1
         OR LOWER(u.email) LIKE $1`;
      params.push(parametroBusca);
      
      if (parametroBuscaTelefone) {
        querySQL += ` OR REPLACE(REPLACE(REPLACE(REPLACE(a.fone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE $2`;
        params.push(parametroBuscaTelefone);
      }
      
      querySQL += `)`;
    }
    
    querySQL += ` ORDER BY a.nome ASC`;
    
    const result = await query(querySQL, params);
    
    atletas = result.rows.map((row: any) => {
      // Usar o mesmo padrão de cards de clientes
      const usuarioEmail = row.usuario_email || null;
      const atleta = {
        id: row.id,
        nome: row.nome,
        dataNascimento: row.dataNascimento,
        genero: row.genero,
        categoria: row.categoria,
        esportePreferido: row.esportePreferido || null,
        fotoUrl: row.fotoUrl,
        fone: row.fone,
        pointIdPrincipal: row.pointIdPrincipal,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        usuarioId: row.usuario_id || null,
        usuarioEmail: usuarioEmail,
        usuario: row.usuario_id ? { 
          id: row.usuario_id,
          name: row.usuario_name, 
          email: usuarioEmail,
          role: row.usuario_role 
        } : null,
        idade: calcularIdade(row.dataNascimento),
      };
      return atleta;
    });
  } 
  // ORGANIZER vê apenas atletas vinculados à sua arena (arena principal ou nas arenas que frequenta)
  else if (usuario.role === "ORGANIZER" && usuario.pointIdGestor) {
    // Usar o mesmo padrão de cards de clientes: underscore nos aliases
    // Usar DISTINCT ON para evitar duplicação quando atleta tem múltiplas arenas frequentes
    let querySQL = `SELECT DISTINCT ON (a.id) a.*, 
              u.id as "usuario_id", 
              u.name as "usuario_name", 
              u.email as "usuario_email", 
              u.role as "usuario_role" 
       FROM "Atleta" a 
       LEFT JOIN "User" u ON a."usuarioId" = u.id 
       LEFT JOIN "AtletaPoint" ap ON a.id = ap."atletaId"
       WHERE (a."pointIdPrincipal" = $1 OR ap."pointId" = $1)`;
    
    const params: any[] = [usuario.pointIdGestor];
    
    if (parametroBusca) {
      querySQL += ` AND (
         LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE $${params.length + 1}
         OR LOWER(u.email) LIKE $${params.length + 1}`;
      params.push(parametroBusca);
      
      if (parametroBuscaTelefone) {
        querySQL += ` OR REPLACE(REPLACE(REPLACE(REPLACE(a.fone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE $${params.length + 1}`;
        params.push(parametroBuscaTelefone);
      }
      
      querySQL += `)`;
    }
    
    querySQL += ` ORDER BY a.id, a.nome ASC`;
    
    const result = await query(querySQL, params);
    
    atletas = result.rows.map((row: any) => {
      // Usar o mesmo padrão de cards de clientes
      const usuarioEmail = row.usuario_email || null;
      
      const atleta = {
        id: row.id,
        nome: row.nome,
        dataNascimento: row.dataNascimento,
        genero: row.genero,
        categoria: row.categoria,
        esportePreferido: row.esportePreferido || null,
        fotoUrl: row.fotoUrl,
        fone: row.fone,
        pointIdPrincipal: row.pointIdPrincipal,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        usuarioId: row.usuario_id || null,
        usuarioEmail: usuarioEmail,
        usuario: row.usuario_id ? { 
          id: row.usuario_id,
          name: row.usuario_name, 
          email: usuarioEmail,
          role: row.usuario_role 
        } : null,
        idade: calcularIdade(row.dataNascimento),
      };
      return atleta;
    });
  } else {
    // USER comum vê apenas seus próprios atletas
    // Usar o mesmo padrão de cards de clientes: underscore nos aliases
    let querySQL = `SELECT a.*, 
              u.id as "usuario_id", 
              u.name as "usuario_name", 
              u.email as "usuario_email", 
              u.role as "usuario_role" 
       FROM "Atleta" a 
       LEFT JOIN "User" u ON a."usuarioId" = u.id 
       WHERE a."usuarioId" = $1`;
    
    const params: any[] = [usuario.id];
    
    if (parametroBusca) {
      querySQL += ` AND (
         LOWER(TRANSLATE(a.nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE $${params.length + 1}
         OR LOWER(u.email) LIKE $${params.length + 1}`;
      params.push(parametroBusca);
      
      if (parametroBuscaTelefone) {
        querySQL += ` OR REPLACE(REPLACE(REPLACE(REPLACE(a.fone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE $${params.length + 1}`;
        params.push(parametroBuscaTelefone);
      }
      
      querySQL += `)`;
    }
    
    querySQL += ` ORDER BY a.nome ASC`;
    
    const result = await query(querySQL, params);
    
    atletas = result.rows.map((row: any) => {
      // Usar o mesmo padrão de cards de clientes
      const usuarioEmail = row.usuario_email || null;
      
      return {
        ...row,
        usuarioId: row.usuario_id || null,
        usuarioEmail: usuarioEmail,
        usuario: row.usuario_id ? { 
          id: row.usuario_id,
          name: row.usuario_name, 
          email: usuarioEmail,
          role: row.usuario_role 
        } : null,
        idade: calcularIdade(row.dataNascimento),
      };
    });
  }

  // Otimização: carregar arenas em batch ao invés de uma query por atleta
  const atletasComArenas = await carregarArenasEmBatch(atletas);

  return {
    atletas: atletasComArenas,
    usuario: { id: usuario.id, role: usuario.role },
  };
}

// Função auxiliar para carregar arenas em batch (otimização de performance)
async function carregarArenasEmBatch(atletas: any[]) {
  if (atletas.length === 0) {
    return [];
  }

  const atletaIds = atletas.map(a => a.id);
  const pointIdsPrincipais = atletas
    .map(a => a.pointIdPrincipal)
    .filter((id): id is string => id != null);

  // Buscar todas as arenas frequentes de uma vez
  let arenasFrequentesMap: Record<string, any[]> = {};
  try {
    const arenasFrequentesResult = await query(
      `SELECT ap."atletaId", p.id, p.nome, p."logoUrl"
       FROM "AtletaPoint" ap
       JOIN "Point" p ON ap."pointId" = p.id
       WHERE ap."atletaId" = ANY($1::text[])
       ORDER BY ap."atletaId", p.nome ASC`,
      [atletaIds]
    );
    
    // Agrupar por atletaId
    for (const row of arenasFrequentesResult.rows) {
      const atletaId = row.atletaId;
      if (!arenasFrequentesMap[atletaId]) {
        arenasFrequentesMap[atletaId] = [];
      }
      arenasFrequentesMap[atletaId].push({
        id: row.id,
        nome: row.nome,
        logoUrl: row.logoUrl,
      });
    }
  } catch (error: any) {
    console.warn('Erro ao buscar arenas frequentes em batch (tabela pode não existir ainda):', error?.message);
  }

  // Buscar todas as arenas principais de uma vez
  let arenasPrincipaisMap: Record<string, any> = {};
  if (pointIdsPrincipais.length > 0) {
    try {
      const arenasPrincipaisResult = await query(
        `SELECT id, nome, "logoUrl" FROM "Point" WHERE id = ANY($1::text[])`,
        [pointIdsPrincipais]
      );
      
      // Criar mapa por id
      for (const row of arenasPrincipaisResult.rows) {
        arenasPrincipaisMap[row.id] = {
          id: row.id,
          nome: row.nome,
          logoUrl: row.logoUrl,
        };
      }
    } catch (error: any) {
      console.warn('Erro ao buscar arenas principais em batch:', error?.message);
    }
  }

  // Combinar dados
  return atletas.map((atleta) => {
    // Parse esportesPratica se for JSON string
    let esportesPratica = null;
    if (atleta.esportesPratica) {
      if (Array.isArray(atleta.esportesPratica)) {
        esportesPratica = atleta.esportesPratica;
      } else if (typeof atleta.esportesPratica === 'string') {
        try {
          esportesPratica = JSON.parse(atleta.esportesPratica);
        } catch (e) {
          console.warn(`Erro ao fazer parse de esportesPratica do atleta ${atleta.id}:`, e);
          esportesPratica = null;
        }
      }
    }

    return {
      ...atleta,
      esportesPratica,
      arenasFrequentes: arenasFrequentesMap[atleta.id] || [],
      arenaPrincipal: atleta.pointIdPrincipal ? (arenasPrincipaisMap[atleta.pointIdPrincipal] || null) : null,
    };
  });
}

export async function listarAtletasPaginados(busca: string = "", pagina: number = 1, limite: number = 10) {
  const offset = (pagina - 1) * limite;
  
  // Normalizar busca removendo acentuação
  const buscaNormalizada = busca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  
  const result = await query(
    `SELECT id, nome, "dataNascimento" 
     FROM "Atleta" 
     WHERE LOWER(TRANSLATE(nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) LIKE LOWER($1)
     ORDER BY nome ASC 
     LIMIT $2 OFFSET $3`,
    [`%${buscaNormalizada}%`, limite, offset]
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
  // Usar o mesmo padrão de cards de clientes: underscore nos aliases
  const result = await query(
    `SELECT a.*, 
            u.id as "usuario_id", 
            u.name as "usuario_name", 
            u.email as "usuario_email", 
            u.role as "usuario_role" 
     FROM "Atleta" a 
     LEFT JOIN "User" u ON a."usuarioId" = u.id 
     WHERE a.id = $1`,
    [atletaId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const usuarioEmail = row.usuario_email || null;
  
  const atleta = {
    ...row,
    usuarioId: row.usuario_id || null,
    usuarioEmail: usuarioEmail,
    usuario: row.usuario_id ? {
      id: row.usuario_id,
      name: row.usuario_name,
      email: usuarioEmail,
      role: row.usuario_role
    } : null
  };
  
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
  
  // Parse esportesPratica se for JSON string
  const esportesPratica = atleta.esportesPratica 
    ? (Array.isArray(atleta.esportesPratica) ? atleta.esportesPratica : JSON.parse(atleta.esportesPratica))
    : null;

  return {
    ...atleta,
    // Preservar usuarioEmail e usuario que já foram mapeados corretamente acima
    idade: calcularIdade(atleta.dataNascimento),
    esportesPratica: esportesPratica,
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
  esportePreferido?: string | null;
  esportesPratica?: string[];
  aceitaLembretesAgendamento?: boolean;
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
  if (dados.esportePreferido !== undefined) {
    campos.push(`"esportePreferido" = $${paramIndex++}`);
    valores.push(dados.esportePreferido || null);
  }
  if (dados.esportesPratica !== undefined) {
    const esportesPraticaJson = dados.esportesPratica && Array.isArray(dados.esportesPratica) && dados.esportesPratica.length > 0
      ? JSON.stringify(dados.esportesPratica)
      : null;
    campos.push(`"esportesPratica" = $${paramIndex++}`);
    valores.push(esportesPraticaJson);
  }
  if (dados.aceitaLembretesAgendamento !== undefined) {
    campos.push(`"aceitaLembretesAgendamento" = $${paramIndex++}`);
    valores.push(dados.aceitaLembretesAgendamento);
  }
  if (dados.pointIdPrincipal !== undefined) {
    campos.push(`"pointIdPrincipal" = $${paramIndex++}`);
    valores.push(dados.pointIdPrincipal || null);
  }

  if (campos.length > 0) {
    campos.push(`"updatedAt" = NOW()`);
    valores.push(atletaId);

    const queryStr = `UPDATE "Atleta" SET ${campos.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(queryStr, valores);
    console.log('[ATUALIZAR ATLETA] UPDATE executado, resultado:', {
      rows: result.rows.length,
      aceitaLembretesAgendamento: result.rows[0]?.aceitaLembretesAgendamento
    });
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

  console.log('[ATUALIZAR ATLETA] Atleta retornado após buscar:', {
    id: atleta.id,
    aceitaLembretesAgendamento: atleta.aceitaLembretesAgendamento
  });

  return {
    ...atleta,
    idade: calcularIdade(atleta.dataNascimento),
  };
}

// Verificar se um atleta temporário foi criado pela arena do usuário
export async function atletaTemporarioCriadoPelaArena(
  atleta: any,
  usuario: { id: string; role: string; pointIdGestor?: string | null }
): Promise<boolean> {
  // ADMIN pode editar/excluir qualquer atleta temporário
  if (usuario.role === 'ADMIN') {
    // Verificar se é temporário
    const email = atleta.usuarioEmail || atleta.usuario?.email;
    if (!email) return false;
    return email.startsWith('temp_') && email.endsWith('@pendente.local');
  }

  // Verificar se o atleta é temporário
  const email = atleta.usuarioEmail || atleta.usuario?.email;
  if (!email || !email.startsWith('temp_') || !email.endsWith('@pendente.local')) {
    return false;
  }

  // ORGANIZER só pode editar/excluir atletas temporários CRIADOS pela sua arena
  if (usuario.role === 'ORGANIZER' && usuario.pointIdGestor) {
    // Verificar qual arena criou o atleta verificando o usuário criador
    // O atleta temporário foi criado por um usuário (via usuarioId)
    // Precisamos verificar se esse usuário criador é um ORGANIZER da mesma arena
    if (atleta.usuarioId) {
      try {
        const usuarioCriadorResult = await query(
          'SELECT "pointIdGestor" FROM "User" WHERE id = $1',
          [atleta.usuarioId]
        );
        
        if (usuarioCriadorResult.rows.length > 0) {
          const pointIdGestorCriador = usuarioCriadorResult.rows[0].pointIdGestor;
          
          // Se o usuário criador tem o mesmo pointIdGestor, então foi criado por essa arena
          if (pointIdGestorCriador === usuario.pointIdGestor) {
            return true;
          }
        }
      } catch (error: any) {
        console.warn('Erro ao verificar usuário criador:', error?.message);
      }
    }
    
    // Fallback: verificar se o pointIdPrincipal corresponde (pode ter sido alterado)
    // Mas só aceitar se o atleta não tiver sido criado por outra arena
    // Na prática, se chegou aqui, o atleta não foi criado por essa arena
    return false;
  }

  // USER comum só pode editar/excluir seus próprios atletas temporários
  if (usuario.role === 'USER' && atleta.usuarioId === usuario.id) {
    return true;
  }

  return false;
}

export async function deletarAtleta(atletaId: string): Promise<boolean> {
  try {
    // Deletar relacionamentos primeiro
    await query('DELETE FROM "AtletaPoint" WHERE "atletaId" = $1', [atletaId]);
    
    // Deletar o atleta
    const result = await query('DELETE FROM "Atleta" WHERE id = $1', [atletaId]);
    
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Erro ao deletar atleta:', error);
    throw error;
  }
}



