// lib/professorService.ts - Serviços para módulo de professores e aulas
import { query, transaction } from './db';
import { v4 as uuidv4 } from 'uuid';
import { normalizarDataHora } from './db';

// ========== TIPOS ==========

export interface CriarProfessorData {
  especialidade?: string | null;
  bio?: string | null;
  valorHora?: number | null;
  telefoneProfissional?: string | null;
  emailProfissional?: string | null;
  fotoUrl?: string | null;
  logoUrl?: string | null;
  ativo?: boolean;
  aceitaNovosAlunos?: boolean;
}

export interface AtualizarProfessorData {
  especialidade?: string | null;
  bio?: string | null;
  valorHora?: number | null;
  telefoneProfissional?: string | null;
  emailProfissional?: string | null;
  fotoUrl?: string | null;
  logoUrl?: string | null;
  ativo?: boolean;
  aceitaNovosAlunos?: boolean;
}

export interface CriarAulaData {
  professorId: string;
  agendamentoId: string;
  titulo: string;
  descricao?: string | null;
  tipoAula: 'INDIVIDUAL' | 'GRUPO' | 'TURMA';
  nivel?: 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO' | null;
  maxAlunos?: number;
  valorPorAluno?: number | null;
  valorTotal?: number | null;
  status?: 'AGENDADA' | 'CONFIRMADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA' | 'ADIADA';
  dataInicio: string | Date;
  dataFim?: string | Date | null;
  recorrenciaId?: string | null;
  recorrenciaConfig?: any | null;
  observacoes?: string | null;
  materialNecessario?: string | null;
}

export interface InscricaoAlunoData {
  aulaId: string;
  atletaId: string;
  statusInscricao?: 'CONFIRMADO' | 'AGUARDANDO' | 'CANCELADO' | 'FALTOU';
  valorPago?: number | null;
  valorDevido?: number | null;
}

// ========== FUNÇÕES DE PROFESSOR ==========

/**
 * Criar perfil de professor para um usuário
 */
export async function criarProfessor(usuarioId: string, dados: CriarProfessorData) {
  // Verificar se já existe professor para este usuário
  const existing = await query(
    'SELECT id FROM "Professor" WHERE "userId" = $1',
    [usuarioId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Usuário já possui perfil de professor');
  }

  const id = uuidv4();
  const dataInicio = new Date();

  await query(
    `INSERT INTO "Professor" (
      id, "userId", especialidade, bio, "valorHora", 
      "telefoneProfissional", "emailProfissional", 
      "fotoUrl", "logoUrl",
      ativo, "aceitaNovosAlunos", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
    [
      id,
      usuarioId,
      dados.especialidade || null,
      dados.bio || null,
      dados.valorHora || null,
      dados.telefoneProfissional || null,
      dados.emailProfissional || null,
      dados.fotoUrl || null,
      dados.logoUrl || null,
      dados.ativo !== undefined ? dados.ativo : true,
      dados.aceitaNovosAlunos !== undefined ? dados.aceitaNovosAlunos : true,
    ]
  );

  return await buscarProfessorPorId(id);
}

/**
 * Buscar professor por ID
 */
export async function buscarProfessorPorId(professorId: string) {
  const result = await query(
    `SELECT p.*, 
            u.id as "usuario_id",
            u.name as "usuario_name",
            u.email as "usuario_email",
            u.role as "usuario_role"
     FROM "Professor" p
     LEFT JOIN "User" u ON p."userId" = u.id
     WHERE p.id = $1`,
    [professorId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    especialidade: row.especialidade,
    bio: row.bio,
    valorHora: row.valorHora ? parseFloat(row.valorHora) : null,
    telefoneProfissional: row.telefoneProfissional,
    emailProfissional: row.emailProfissional,
    fotoUrl: row.fotoUrl,
    logoUrl: row.logoUrl,
    ativo: row.ativo,
    aceitaNovosAlunos: row.aceitaNovosAlunos,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    usuario: row.usuario_id ? {
      id: row.usuario_id,
      name: row.usuario_name,
      email: row.usuario_email,
      role: row.usuario_role,
    } : null,
  };
}

/**
 * Buscar professor por userId
 */
export async function buscarProfessorPorUserId(userId: string) {
  const result = await query(
    `SELECT p.*, 
            u.id as "usuario_id",
            u.name as "usuario_name",
            u.email as "usuario_email",
            u.role as "usuario_role"
     FROM "Professor" p
     LEFT JOIN "User" u ON p."userId" = u.id
     WHERE p."userId" = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    especialidade: row.especialidade,
    bio: row.bio,
    valorHora: row.valorHora ? parseFloat(row.valorHora) : null,
    telefoneProfissional: row.telefoneProfissional,
    emailProfissional: row.emailProfissional,
    fotoUrl: row.fotoUrl,
    logoUrl: row.logoUrl,
    ativo: row.ativo,
    aceitaNovosAlunos: row.aceitaNovosAlunos,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    usuario: row.usuario_id ? {
      id: row.usuario_id,
      name: row.usuario_name,
      email: row.usuario_email,
      role: row.usuario_role,
    } : null,
  };
}

/**
 * Atualizar professor
 */
export async function atualizarProfessor(professorId: string, dados: AtualizarProfessorData) {
  const campos: string[] = [];
  const valores: any[] = [];
  let paramIndex = 1;

  if (dados.especialidade !== undefined) {
    campos.push(`especialidade = $${paramIndex++}`);
    valores.push(dados.especialidade || null);
  }
  if (dados.bio !== undefined) {
    campos.push(`bio = $${paramIndex++}`);
    valores.push(dados.bio || null);
  }
  if (dados.valorHora !== undefined) {
    campos.push(`"valorHora" = $${paramIndex++}`);
    valores.push(dados.valorHora || null);
  }
  if (dados.telefoneProfissional !== undefined) {
    campos.push(`"telefoneProfissional" = $${paramIndex++}`);
    valores.push(dados.telefoneProfissional || null);
  }
  if (dados.emailProfissional !== undefined) {
    campos.push(`"emailProfissional" = $${paramIndex++}`);
    valores.push(dados.emailProfissional || null);
  }
  if (dados.fotoUrl !== undefined) {
    campos.push(`"fotoUrl" = $${paramIndex++}`);
    valores.push(dados.fotoUrl || null);
  }
  if (dados.logoUrl !== undefined) {
    campos.push(`"logoUrl" = $${paramIndex++}`);
    valores.push(dados.logoUrl || null);
  }
  if (dados.ativo !== undefined) {
    campos.push(`ativo = $${paramIndex++}`);
    valores.push(dados.ativo);
  }
  if (dados.aceitaNovosAlunos !== undefined) {
    campos.push(`"aceitaNovosAlunos" = $${paramIndex++}`);
    valores.push(dados.aceitaNovosAlunos);
  }

  if (campos.length === 0) {
    return await buscarProfessorPorId(professorId);
  }

  valores.push(professorId);
  await query(
    `UPDATE "Professor" 
     SET ${campos.join(', ')}, "updatedAt" = NOW()
     WHERE id = $${paramIndex}`,
    valores
  );

  return await buscarProfessorPorId(professorId);
}

/**
 * Deletar professor
 */
export async function deletarProfessor(professorId: string) {
  // Verificar se o professor existe
  const professor = await buscarProfessorPorId(professorId);
  if (!professor) {
    throw new Error('Professor não encontrado');
  }

  // Deletar o registro
  await query('DELETE FROM "Professor" WHERE id = $1', [professorId]);

  return { mensagem: 'Professor deletado com sucesso' };
}

/**
 * Listar professores (com filtros opcionais)
 */
export async function listarProfessores(filtros?: {
  ativo?: boolean;
  aceitaNovosAlunos?: boolean;
}) {
  let whereClause = '';
  const params: any[] = [];
  let paramIndex = 1;

  if (filtros?.ativo !== undefined) {
    whereClause += `WHERE p.ativo = $${paramIndex++}`;
    params.push(filtros.ativo);
  }
  if (filtros?.aceitaNovosAlunos !== undefined) {
    whereClause += whereClause ? ' AND ' : 'WHERE ';
    whereClause += `p."aceitaNovosAlunos" = $${paramIndex++}`;
    params.push(filtros.aceitaNovosAlunos);
  }

  const result = await query(
    `SELECT p.*, 
            u.id as "usuario_id",
            u.name as "usuario_name",
            u.email as "usuario_email",
            u.role as "usuario_role"
     FROM "Professor" p
     LEFT JOIN "User" u ON p."userId" = u.id
     ${whereClause}
     ORDER BY p."createdAt" DESC`,
    params
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    userId: row.userId,
    especialidade: row.especialidade,
    bio: row.bio,
    valorHora: row.valorHora ? parseFloat(row.valorHora) : null,
    telefoneProfissional: row.telefoneProfissional,
    emailProfissional: row.emailProfissional,
    fotoUrl: row.fotoUrl,
    logoUrl: row.logoUrl,
    ativo: row.ativo,
    aceitaNovosAlunos: row.aceitaNovosAlunos,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    usuario: row.usuario_id ? {
      id: row.usuario_id,
      name: row.usuario_name,
      email: row.usuario_email,
      role: row.usuario_role,
    } : null,
  }));
}

// ========== FUNÇÕES DE AULA ==========

/**
 * Criar aula vinculada a um agendamento
 */
export async function criarAula(dados: CriarAulaData) {
  // Verificar se o agendamento já tem uma aula vinculada
  const existing = await query(
    'SELECT id FROM "Aula" WHERE "agendamentoId" = $1',
    [dados.agendamentoId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Este agendamento já possui uma aula vinculada');
  }

  const id = uuidv4();
  const dataInicio = normalizarDataHora(dados.dataInicio);
  const dataFim = dados.dataFim ? normalizarDataHora(dados.dataFim) : null;
  const recorrenciaConfigJson = dados.recorrenciaConfig 
    ? JSON.stringify(dados.recorrenciaConfig) 
    : null;

  await query(
    `INSERT INTO "Aula" (
      id, "professorId", "agendamentoId", titulo, descricao, 
      "tipoAula", nivel, "maxAlunos", "valorPorAluno", "valorTotal",
      status, "dataInicio", "dataFim", "recorrenciaId", "recorrenciaConfig",
      observacoes, "materialNecessario", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())`,
    [
      id,
      dados.professorId,
      dados.agendamentoId,
      dados.titulo,
      dados.descricao || null,
      dados.tipoAula,
      dados.nivel || null,
      dados.maxAlunos || 1,
      dados.valorPorAluno || null,
      dados.valorTotal || null,
      dados.status || 'AGENDADA',
      dataInicio,
      dataFim,
      dados.recorrenciaId || null,
      recorrenciaConfigJson,
      dados.observacoes || null,
      dados.materialNecessario || null,
    ]
  );

  return await buscarAulaPorId(id);
}

/**
 * Buscar aula por ID (com relacionamentos)
 */
export async function buscarAulaPorId(aulaId: string) {
  const result = await query(
    `SELECT a.*,
            p.id as "professor_id",
            p."userId" as "professor_userId",
            p.especialidade as "professor_especialidade",
            u.id as "usuario_id",
            u.name as "usuario_name",
            u.email as "usuario_email",
            ag.id as "agendamento_id",
            ag."quadraId" as "agendamento_quadraId",
            ag."dataHora" as "agendamento_dataHora",
            ag.duracao as "agendamento_duracao",
            ag.status as "agendamento_status",
            q.id as "quadra_id",
            q.nome as "quadra_nome",
            q.tipo as "quadra_tipo",
            point.id as "point_id",
            point.nome as "point_nome"
     FROM "Aula" a
     LEFT JOIN "Professor" p ON a."professorId" = p.id
     LEFT JOIN "User" u ON p."userId" = u.id
     LEFT JOIN "Agendamento" ag ON a."agendamentoId" = ag.id
     LEFT JOIN "Quadra" q ON ag."quadraId" = q.id
     LEFT JOIN "Point" point ON q."pointId" = point.id
     WHERE a.id = $1`,
    [aulaId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return formatarAula(row);
}

/**
 * Listar aulas de um professor
 */
export async function listarAulasProfessor(professorId: string, filtros?: {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}) {
  let whereClause = 'WHERE a."professorId" = $1';
  const params: any[] = [professorId];
  let paramIndex = 2;

  if (filtros?.status) {
    whereClause += ` AND a.status = $${paramIndex++}`;
    params.push(filtros.status);
  }
  if (filtros?.dataInicio) {
    whereClause += ` AND a."dataInicio" >= $${paramIndex++}`;
    params.push(normalizarDataHora(filtros.dataInicio));
  }
  if (filtros?.dataFim) {
    whereClause += ` AND a."dataInicio" <= $${paramIndex++}`;
    params.push(normalizarDataHora(filtros.dataFim));
  }

  const result = await query(
    `SELECT a.*,
            p.id as "professor_id",
            p."userId" as "professor_userId",
            p.especialidade as "professor_especialidade",
            u.id as "usuario_id",
            u.name as "usuario_name",
            u.email as "usuario_email",
            ag.id as "agendamento_id",
            ag."quadraId" as "agendamento_quadraId",
            ag."dataHora" as "agendamento_dataHora",
            ag.duracao as "agendamento_duracao",
            ag.status as "agendamento_status",
            q.id as "quadra_id",
            q.nome as "quadra_nome",
            q.tipo as "quadra_tipo",
            point.id as "point_id",
            point.nome as "point_nome"
     FROM "Aula" a
     LEFT JOIN "Professor" p ON a."professorId" = p.id
     LEFT JOIN "User" u ON p."userId" = u.id
     LEFT JOIN "Agendamento" ag ON a."agendamentoId" = ag.id
     LEFT JOIN "Quadra" q ON ag."quadraId" = q.id
     LEFT JOIN "Point" point ON q."pointId" = point.id
     ${whereClause}
     ORDER BY a."dataInicio" ASC`,
    params
  );

  return result.rows.map((row: any) => formatarAula(row));
}

/**
 * Atualizar aula
 */
export async function atualizarAula(aulaId: string, dados: Partial<CriarAulaData>) {
  const campos: string[] = [];
  const valores: any[] = [];
  let paramIndex = 1;

  if (dados.titulo !== undefined) {
    campos.push(`titulo = $${paramIndex++}`);
    valores.push(dados.titulo);
  }
  if (dados.descricao !== undefined) {
    campos.push(`descricao = $${paramIndex++}`);
    valores.push(dados.descricao || null);
  }
  if (dados.tipoAula !== undefined) {
    campos.push(`"tipoAula" = $${paramIndex++}`);
    valores.push(dados.tipoAula);
  }
  if (dados.nivel !== undefined) {
    campos.push(`nivel = $${paramIndex++}`);
    valores.push(dados.nivel || null);
  }
  if (dados.maxAlunos !== undefined) {
    campos.push(`"maxAlunos" = $${paramIndex++}`);
    valores.push(dados.maxAlunos);
  }
  if (dados.valorPorAluno !== undefined) {
    campos.push(`"valorPorAluno" = $${paramIndex++}`);
    valores.push(dados.valorPorAluno || null);
  }
  if (dados.valorTotal !== undefined) {
    campos.push(`"valorTotal" = $${paramIndex++}`);
    valores.push(dados.valorTotal || null);
  }
  if (dados.status !== undefined) {
    campos.push(`status = $${paramIndex++}`);
    valores.push(dados.status);
  }
  if (dados.dataInicio !== undefined) {
    campos.push(`"dataInicio" = $${paramIndex++}`);
    valores.push(normalizarDataHora(dados.dataInicio));
  }
  if (dados.dataFim !== undefined) {
    campos.push(`"dataFim" = $${paramIndex++}`);
    valores.push(dados.dataFim ? normalizarDataHora(dados.dataFim) : null);
  }
  if (dados.observacoes !== undefined) {
    campos.push(`observacoes = $${paramIndex++}`);
    valores.push(dados.observacoes || null);
  }
  if (dados.materialNecessario !== undefined) {
    campos.push(`"materialNecessario" = $${paramIndex++}`);
    valores.push(dados.materialNecessario || null);
  }

  if (campos.length === 0) {
    return await buscarAulaPorId(aulaId);
  }

  valores.push(aulaId);
  await query(
    `UPDATE "Aula" 
     SET ${campos.join(', ')}, "updatedAt" = NOW()
     WHERE id = $${paramIndex}`,
    valores
  );

  return await buscarAulaPorId(aulaId);
}

// ========== FUNÇÕES DE ALUNO/AULA ==========

/**
 * Inscrever aluno em uma aula
 */
export async function inscreverAlunoEmAula(dados: InscricaoAlunoData) {
  // Verificar se já está inscrito
  const existing = await query(
    'SELECT id FROM "AlunoAula" WHERE "aulaId" = $1 AND "atletaId" = $2',
    [dados.aulaId, dados.atletaId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Aluno já está inscrito nesta aula');
  }

  // Verificar se há vagas
  const aula = await query(
    'SELECT "maxAlunos", (SELECT COUNT(*) FROM "AlunoAula" WHERE "aulaId" = $1) as "inscritos" FROM "Aula" WHERE id = $1',
    [dados.aulaId]
  );

  if (aula.rows.length === 0) {
    throw new Error('Aula não encontrada');
  }

  const maxAlunos = aula.rows[0].maxAlunos || 1;
  const inscritos = parseInt(aula.rows[0].inscritos || '0');

  if (inscritos >= maxAlunos) {
    throw new Error('Aula lotada');
  }

  const id = uuidv4();

  await query(
    `INSERT INTO "AlunoAula" (
      id, "aulaId", "atletaId", "statusInscricao", 
      "valorPago", "valorDevido", "inscritoEm", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())`,
    [
      id,
      dados.aulaId,
      dados.atletaId,
      dados.statusInscricao || 'CONFIRMADO',
      dados.valorPago || null,
      dados.valorDevido || null,
    ]
  );

  return await buscarInscricaoPorId(id);
}

/**
 * Buscar inscrição por ID
 */
export async function buscarInscricaoPorId(inscricaoId: string) {
  const result = await query(
    `SELECT aa.*,
            a.id as "atleta_id",
            a.nome as "atleta_nome",
            a.fone as "atleta_fone",
            aula.id as "aula_id",
            aula.titulo as "aula_titulo"
     FROM "AlunoAula" aa
     LEFT JOIN "Atleta" a ON aa."atletaId" = a.id
     LEFT JOIN "Aula" aula ON aa."aulaId" = aula.id
     WHERE aa.id = $1`,
    [inscricaoId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    aulaId: row.aulaId,
    atletaId: row.atletaId,
    statusInscricao: row.statusInscricao,
    presenca: row.presenca,
    valorPago: row.valorPago ? parseFloat(row.valorPago) : null,
    valorDevido: row.valorDevido ? parseFloat(row.valorDevido) : null,
    observacao: row.observacao,
    notaAluno: row.notaAluno,
    inscritoEm: row.inscritoEm,
    canceladoEm: row.canceladoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    atleta: row.atleta_id ? {
      id: row.atleta_id,
      nome: row.atleta_nome,
      fone: row.atleta_fone,
    } : null,
    aula: row.aula_id ? {
      id: row.aula_id,
      titulo: row.aula_titulo,
    } : null,
  };
}

/**
 * Listar alunos de uma aula
 */
export async function listarAlunosDaAula(aulaId: string) {
  const result = await query(
    `SELECT aa.*,
            a.id as "atleta_id",
            a.nome as "atleta_nome",
            a.fone as "atleta_fone",
            a."fotoUrl" as "atleta_fotoUrl"
     FROM "AlunoAula" aa
     LEFT JOIN "Atleta" a ON aa."atletaId" = a.id
     WHERE aa."aulaId" = $1
     ORDER BY aa."inscritoEm" ASC`,
    [aulaId]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    aulaId: row.aulaId,
    atletaId: row.atletaId,
    statusInscricao: row.statusInscricao,
    presenca: row.presenca,
    valorPago: row.valorPago ? parseFloat(row.valorPago) : null,
    valorDevido: row.valorDevido ? parseFloat(row.valorDevido) : null,
    observacao: row.observacao,
    notaAluno: row.notaAluno,
    inscritoEm: row.inscritoEm,
    canceladoEm: row.canceladoEm,
    atleta: row.atleta_id ? {
      id: row.atleta_id,
      nome: row.atleta_nome,
      fone: row.atleta_fone,
      fotoUrl: row.atleta_fotoUrl,
    } : null,
  }));
}

/**
 * Marcar presença de um aluno
 */
export async function marcarPresenca(inscricaoId: string, presenca: boolean) {
  await query(
    'UPDATE "AlunoAula" SET presenca = $1, "updatedAt" = NOW() WHERE id = $2',
    [presenca, inscricaoId]
  );

  return await buscarInscricaoPorId(inscricaoId);
}

// ========== FUNÇÕES DE ALUNO/PROFESSOR ==========

/**
 * Criar relação entre professor e aluno (longo prazo)
 */
export async function criarAlunoProfessor(
  professorId: string,
  atletaId: string,
  dados?: { nivel?: 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO' | null; observacoes?: string | null }
) {
  // Verificar se já existe relação
  const existing = await query(
    'SELECT id FROM "AlunoProfessor" WHERE "professorId" = $1 AND "atletaId" = $2',
    [professorId, atletaId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Relação professor-aluno já existe');
  }

  const id = uuidv4();

  await query(
    `INSERT INTO "AlunoProfessor" (
      id, "professorId", "atletaId", nivel, observacoes, ativo, "iniciadoEm", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW(), NOW())`,
    [
      id,
      professorId,
      atletaId,
      dados?.nivel || null,
      dados?.observacoes || null,
    ]
  );

  return await buscarAlunoProfessorPorId(id);
}

/**
 * Buscar relação professor-aluno por ID
 */
export async function buscarAlunoProfessorPorId(id: string) {
  const result = await query(
    `SELECT ap.*,
            p.id as "professor_id",
            p."userId" as "professor_userId",
            a.id as "atleta_id",
            a.nome as "atleta_nome",
            a.fone as "atleta_fone",
            a."fotoUrl" as "atleta_fotoUrl"
     FROM "AlunoProfessor" ap
     LEFT JOIN "Professor" p ON ap."professorId" = p.id
     LEFT JOIN "Atleta" a ON ap."atletaId" = a.id
     WHERE ap.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    professorId: row.professorId,
    atletaId: row.atletaId,
    nivel: row.nivel,
    observacoes: row.observacoes,
    ativo: row.ativo,
    iniciadoEm: row.iniciadoEm,
    encerradoEm: row.encerradoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    atleta: row.atleta_id ? {
      id: row.atleta_id,
      nome: row.atleta_nome,
      fone: row.atleta_fone,
      fotoUrl: row.atleta_fotoUrl,
    } : null,
  };
}

/**
 * Listar alunos de um professor
 */
export async function listarAlunosDoProfessor(professorId: string, apenasAtivos: boolean = true) {
  let whereClause = 'WHERE ap."professorId" = $1';
  const params: any[] = [professorId];

  if (apenasAtivos) {
    whereClause += ' AND ap.ativo = true';
  }

  const result = await query(
    `SELECT ap.*,
            a.id as "atleta_id",
            a.nome as "atleta_nome",
            a.fone as "atleta_fone",
            a."fotoUrl" as "atleta_fotoUrl"
     FROM "AlunoProfessor" ap
     LEFT JOIN "Atleta" a ON ap."atletaId" = a.id
     ${whereClause}
     ORDER BY ap."iniciadoEm" DESC`,
    params
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    professorId: row.professorId,
    atletaId: row.atletaId,
    nivel: row.nivel,
    observacoes: row.observacoes,
    ativo: row.ativo,
    iniciadoEm: row.iniciadoEm,
    encerradoEm: row.encerradoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    atleta: row.atleta_id ? {
      id: row.atleta_id,
      nome: row.atleta_nome,
      fone: row.atleta_fone,
      fotoUrl: row.atleta_fotoUrl,
    } : null,
  }));
}

/**
 * Atualizar relação professor-aluno
 */
export async function atualizarAlunoProfessor(
  id: string,
  dados: { nivel?: 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO' | null; observacoes?: string | null; ativo?: boolean }
) {
  const campos: string[] = [];
  const valores: any[] = [];
  let paramIndex = 1;

  if (dados.nivel !== undefined) {
    campos.push(`nivel = $${paramIndex++}`);
    valores.push(dados.nivel || null);
  }
  if (dados.observacoes !== undefined) {
    campos.push(`observacoes = $${paramIndex++}`);
    valores.push(dados.observacoes || null);
  }
  if (dados.ativo !== undefined) {
    campos.push(`ativo = $${paramIndex++}`);
    valores.push(dados.ativo);
    if (!dados.ativo) {
      // Se está desativando, marcar encerradoEm
      campos.push(`"encerradoEm" = NOW()`);
    } else {
      campos.push(`"encerradoEm" = NULL`);
    }
  }

  if (campos.length === 0) {
    return await buscarAlunoProfessorPorId(id);
  }

  valores.push(id);
  await query(
    `UPDATE "AlunoProfessor" 
     SET ${campos.join(', ')}, "updatedAt" = NOW()
     WHERE id = $${paramIndex}`,
    valores
  );

  return await buscarAlunoProfessorPorId(id);
}

// ========== FUNÇÕES DE AVALIAÇÃO ==========

/**
 * Criar avaliação de aluno
 */
export async function criarAvaliacaoAluno(dados: {
  aulaId: string;
  professorId: string;
  atletaId: string;
  nota?: number | null;
  comentario?: string | null;
  pontosPositivos?: string | null;
  pontosMelhorar?: string | null;
  tecnica?: number | null;
  fisico?: number | null;
  comportamento?: number | null;
}) {
  // Verificar se já existe avaliação para este aluno nesta aula
  const existing = await query(
    'SELECT id FROM "AvaliacaoAluno" WHERE "aulaId" = $1 AND "atletaId" = $2',
    [dados.aulaId, dados.atletaId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Avaliação já existe para este aluno nesta aula');
  }

  const id = uuidv4();

  await query(
    `INSERT INTO "AvaliacaoAluno" (
      id, "aulaId", "professorId", "atletaId", nota, comentario,
      "pontosPositivos", "pontosMelhorar", tecnica, fisico, comportamento,
      "avaliadoEm", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())`,
    [
      id,
      dados.aulaId,
      dados.professorId,
      dados.atletaId,
      dados.nota || null,
      dados.comentario || null,
      dados.pontosPositivos || null,
      dados.pontosMelhorar || null,
      dados.tecnica || null,
      dados.fisico || null,
      dados.comportamento || null,
    ]
  );

  return await buscarAvaliacaoPorId(id);
}

/**
 * Buscar avaliação por ID
 */
export async function buscarAvaliacaoPorId(id: string) {
  const result = await query(
    `SELECT aa.*,
            a.id as "atleta_id",
            a.nome as "atleta_nome",
            aula.id as "aula_id",
            aula.titulo as "aula_titulo"
     FROM "AvaliacaoAluno" aa
     LEFT JOIN "Atleta" a ON aa."atletaId" = a.id
     LEFT JOIN "Aula" aula ON aa."aulaId" = aula.id
     WHERE aa.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    aulaId: row.aulaId,
    professorId: row.professorId,
    atletaId: row.atletaId,
    nota: row.nota ? parseFloat(row.nota) : null,
    comentario: row.comentario,
    pontosPositivos: row.pontosPositivos,
    pontosMelhorar: row.pontosMelhorar,
    tecnica: row.tecnica,
    fisico: row.fisico,
    comportamento: row.comportamento,
    avaliadoEm: row.avaliadoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    atleta: row.atleta_id ? {
      id: row.atleta_id,
      nome: row.atleta_nome,
    } : null,
    aula: row.aula_id ? {
      id: row.aula_id,
      titulo: row.aula_titulo,
    } : null,
  };
}

/**
 * Listar avaliações de um atleta
 */
export async function listarAvaliacoesDoAtleta(atletaId: string) {
  const result = await query(
    `SELECT aa.*,
            aula.id as "aula_id",
            aula.titulo as "aula_titulo",
            aula."dataInicio" as "aula_dataInicio",
            p.id as "professor_id",
            u.name as "professor_name"
     FROM "AvaliacaoAluno" aa
     LEFT JOIN "Aula" aula ON aa."aulaId" = aula.id
     LEFT JOIN "Professor" p ON aa."professorId" = p.id
     LEFT JOIN "User" u ON p."userId" = u.id
     WHERE aa."atletaId" = $1
     ORDER BY aa."avaliadoEm" DESC`,
    [atletaId]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    aulaId: row.aulaId,
    professorId: row.professorId,
    atletaId: row.atletaId,
    nota: row.nota ? parseFloat(row.nota) : null,
    comentario: row.comentario,
    pontosPositivos: row.pontosPositivos,
    pontosMelhorar: row.pontosMelhorar,
    tecnica: row.tecnica,
    fisico: row.fisico,
    comportamento: row.comportamento,
    avaliadoEm: row.avaliadoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    aula: row.aula_id ? {
      id: row.aula_id,
      titulo: row.aula_titulo,
      dataInicio: row.aula_dataInicio,
    } : null,
    professor: row.professor_id ? {
      id: row.professor_id,
      nome: row.professor_name,
    } : null,
  }));
}

/**
 * Listar avaliações de uma aula
 */
export async function listarAvaliacoesDaAula(aulaId: string) {
  const result = await query(
    `SELECT aa.*,
            a.id as "atleta_id",
            a.nome as "atleta_nome"
     FROM "AvaliacaoAluno" aa
     LEFT JOIN "Atleta" a ON aa."atletaId" = a.id
     WHERE aa."aulaId" = $1
     ORDER BY aa."avaliadoEm" DESC`,
    [aulaId]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    aulaId: row.aulaId,
    professorId: row.professorId,
    atletaId: row.atletaId,
    nota: row.nota ? parseFloat(row.nota) : null,
    comentario: row.comentario,
    pontosPositivos: row.pontosPositivos,
    pontosMelhorar: row.pontosMelhorar,
    tecnica: row.tecnica,
    fisico: row.fisico,
    comportamento: row.comportamento,
    avaliadoEm: row.avaliadoEm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    atleta: row.atleta_id ? {
      id: row.atleta_id,
      nome: row.atleta_nome,
    } : null,
  }));
}

// ========== FUNÇÕES AUXILIARES ==========

function formatarAula(row: any) {
  const recorrenciaConfig = row.recorrenciaConfig 
    ? (typeof row.recorrenciaConfig === 'string' 
      ? JSON.parse(row.recorrenciaConfig) 
      : row.recorrenciaConfig)
    : null;

  return {
    id: row.id,
    professorId: row.professorId,
    agendamentoId: row.agendamentoId,
    titulo: row.titulo,
    descricao: row.descricao,
    tipoAula: row.tipoAula,
    nivel: row.nivel,
    maxAlunos: row.maxAlunos,
    valorPorAluno: row.valorPorAluno ? parseFloat(row.valorPorAluno) : null,
    valorTotal: row.valorTotal ? parseFloat(row.valorTotal) : null,
    status: row.status,
    dataInicio: row.dataInicio,
    dataFim: row.dataFim,
    recorrenciaId: row.recorrenciaId,
    recorrenciaConfig,
    observacoes: row.observacoes,
    materialNecessario: row.materialNecessario,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    professor: row.professor_id ? {
      id: row.professor_id,
      userId: row.professor_userId,
      especialidade: row.professor_especialidade,
      usuario: row.usuario_id ? {
        id: row.usuario_id,
        name: row.usuario_name,
        email: row.usuario_email,
      } : null,
    } : null,
    agendamento: row.agendamento_id ? {
      id: row.agendamento_id,
      quadraId: row.agendamento_quadraId,
      dataHora: row.agendamento_dataHora,
      duracao: row.agendamento_duracao,
      status: row.agendamento_status,
      quadra: row.quadra_id ? {
        id: row.quadra_id,
        nome: row.quadra_nome,
        tipo: row.quadra_tipo,
        point: row.point_id ? {
          id: row.point_id,
          nome: row.point_nome,
        } : null,
      } : null,
    } : null,
  };
}

