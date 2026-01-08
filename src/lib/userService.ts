// lib/userService.ts
import { query } from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const createUser = async (
  name: string,
  email: string,
  password: string,
  role: string = 'USER'
) => {
  if (!name || !email || !password) {
    throw new Error("name, email e password são obrigatórios");
  }

  // Validar role
  const rolesValidos = ['ADMIN', 'ORGANIZER', 'USER'];
  if (!rolesValidos.includes(role)) {
    throw new Error(`Role inválido. Deve ser um dos: ${rolesValidos.join(', ')}`);
  }

  const exists = await query('SELECT id FROM "User" WHERE email = $1', [email.toLowerCase().trim()]);
  if (exists.rows.length > 0) {
    throw new Error("E-mail já cadastrado");
  }

  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  await query(
    'INSERT INTO "User" (id, name, email, password, role, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
    [id, name, email.toLowerCase().trim(), hash, role]
  );

  const result = await query(
    'SELECT id, name, email, role FROM "User" WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

export const getAllUsers = async () => {
  const result = await query('SELECT * FROM "User"', []);
  return result.rows;
};

export const atualizarUsuario = async (id: string, dados: { name?: string; password?: string }) => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (dados.name) {
    updates.push(`name = $${paramIndex++}`);
    values.push(dados.name);
  }
  if (dados.password) {
    updates.push(`password = $${paramIndex++}`);
    values.push(await bcrypt.hash(dados.password, 10));
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(id);
  await query(
    `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  const result = await query('SELECT * FROM "User" WHERE id = $1', [id]);
  return result.rows[0];
};

export const getUsuarioById = async (id: string) => {
  const result = await query(
    'SELECT id, name, email, role, "pointIdGestor" FROM "User" WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const getUsuarioByEmail = async (email: string) => {
  const result = await query(
    'SELECT id, name, email, role FROM "User" WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
};

// Criar usuário incompleto (sem email/senha) - para vínculo posterior por telefone
export const createUserIncompleto = async (
  name: string,
  telefone: string,
  role: string = 'USER',
  pointIdGestor?: string | null
) => {
  if (!name || !telefone) {
    throw new Error("name e telefone são obrigatórios");
  }

  // Validar role
  const rolesValidos = ['ADMIN', 'ORGANIZER', 'USER'];
  if (!rolesValidos.includes(role)) {
    throw new Error(`Role inválido. Deve ser um dos: ${rolesValidos.join(', ')}`);
  }

  // Normalizar telefone (remover caracteres não numéricos)
  const telefoneNormalizado = telefone.replace(/\D/g, '');

  // Verificar se já existe atleta com este telefone
  const atletaExistente = await query(
    `SELECT a.id, a."usuarioId", u.id as "userId", u.email, u.name
     FROM "Atleta" a
     LEFT JOIN "User" u ON a."usuarioId" = u.id
     WHERE REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') = $1 
     LIMIT 1`,
    [telefoneNormalizado]
  );

  if (atletaExistente.rows.length > 0) {
    const atleta = atletaExistente.rows[0];
    
    // Se já tem usuário vinculado, retornar erro
    if (atleta.usuarioId) {
      throw new Error("Já existe um usuário cadastrado com este telefone");
    }
    
    // Se existe atleta sem usuário, vincular ao usuário que está sendo criado
    // Mas isso não faz sentido aqui porque estamos criando um novo usuário
    // Então vamos criar o usuário e depois vincular o atleta existente
  }

  // Criar usuário sem email e senha válidos
  const id = uuidv4();
  
  // Verificar se a coluna email permite NULL (pode não permitir, então vamos usar um email temporário único)
  // Usar um email temporário baseado no ID para evitar constraint NOT NULL
  const emailTemporario = `temp_${id}@pendente.local`;

  // Usar uma senha temporária que nunca será usada (hash de string aleatória)
  // Isso evita o erro de NOT NULL constraint na coluna password
  // Quando o usuário completar o cadastro, a senha será atualizada
  // Gerar uma senha aleatória única baseada no ID e timestamp
  const senhaTemporariaAleatoria = `temp_${id}_${Date.now()}_${Math.random().toString(36)}`;
  const senhaTemporaria = await bcrypt.hash(senhaTemporariaAleatoria, 12);

  await query(
    'INSERT INTO "User" (id, name, email, password, role, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
    [id, name, emailTemporario, senhaTemporaria, role]
  );

  // Verificar se já existe atleta sem usuário para vincular
  let atletaId: string;
  if (atletaExistente.rows.length > 0 && !atletaExistente.rows[0].usuarioId) {
    // Vincular atleta existente ao novo usuário
    atletaId = atletaExistente.rows[0].id;
    await query(
      'UPDATE "Atleta" SET "usuarioId" = $1, nome = $2, "updatedAt" = NOW() WHERE id = $3',
      [id, name, atletaId]
    );
  } else {
    // Criar novo atleta vinculado ao usuário
    // Usar uma data de nascimento padrão (01/01/2000) para evitar constraint NOT NULL
    // Quando o usuário completar o cadastro, a data será atualizada
    atletaId = uuidv4();
    const dataNascimentoPadrao = new Date('2000-01-01'); // Data padrão para usuários incompletos
    
    // Se o organizador tem uma arena (pointIdGestor), vincular automaticamente
    const pointIdPrincipal = pointIdGestor || null;
    
    await query(
      'INSERT INTO "Atleta" (id, nome, fone, "dataNascimento", "usuarioId", "pointIdPrincipal", "aceitaLembretesAgendamento", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())',
      [atletaId, name, telefoneNormalizado, dataNascimentoPadrao, id, pointIdPrincipal, true]
    );
    
    // Adicionar nas arenas que frequenta (se houver arena)
    if (pointIdGestor) {
      try {
        await query(
          'INSERT INTO "AtletaPoint" ("atletaId", "pointId", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("atletaId", "pointId") DO NOTHING',
          [atletaId, pointIdGestor]
        );
      } catch (error: any) {
        // Se a tabela não existir, apenas logar (não é crítico)
        if (!error.message?.includes('does not exist')) {
          console.warn('Erro ao vincular atleta às arenas frequentes:', error?.message);
        }
      }
    }
  }

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, a.id as "atletaId", a.fone as telefone
     FROM "User" u
     LEFT JOIN "Atleta" a ON a."usuarioId" = u.id
     WHERE u.id = $1`,
    [id]
  );
  
  return result.rows[0];
};

// Completar cadastro de usuário incompleto
export const completarCadastroUsuario = async (
  telefone: string,
  email: string,
  password: string,
  dadosAtleta?: {
    nome?: string;
    dataNascimento?: string;
    categoria?: string | null;
    genero?: string | null;
    fotoUrl?: string | null;
    pointIdPrincipal?: string | null;
    pointIdsFrequentes?: string[];
  }
) => {
  if (!telefone || !email || !password) {
    throw new Error("telefone, email e senha são obrigatórios");
  }

  // Normalizar telefone
  const telefoneNormalizado = telefone.replace(/\D/g, '');

  // Buscar atleta com este telefone que tenha usuário com email temporário
  const atletaResult = await query(
    `SELECT a.id as "atletaId", a."usuarioId", a.nome, u.email, u.name
     FROM "Atleta" a
     INNER JOIN "User" u ON a."usuarioId" = u.id
     WHERE REGEXP_REPLACE(a.fone, '[^0-9]', '', 'g') = $1
       AND u.email LIKE 'temp_%@pendente.local'
     LIMIT 1`,
    [telefoneNormalizado]
  );

  if (atletaResult.rows.length === 0) {
    throw new Error("Telefone não encontrado. Verifique o número ou crie uma nova conta.");
  }

  const { atletaId, usuarioId, nome: nomeAtual } = atletaResult.rows[0];

  // Verificar se email já está em uso
  const emailExistente = await query(
    'SELECT id FROM "User" WHERE email = $1 AND id != $2',
    [email.toLowerCase().trim(), usuarioId]
  );
  
  if (emailExistente.rows.length > 0) {
    throw new Error("Este e-mail já está cadastrado");
  }

  // Atualizar usuário com email e senha
  const hash = await bcrypt.hash(password, 12);
  await query(
    'UPDATE "User" SET email = $1, password = $2 WHERE id = $3',
    [email.toLowerCase().trim(), hash, usuarioId]
  );

  // Atualizar dados do atleta se fornecidos
  if (dadosAtleta) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dadosAtleta.nome) {
      updates.push(`nome = $${paramIndex++}`);
      values.push(dadosAtleta.nome);
    }
    if (dadosAtleta.dataNascimento) {
      updates.push(`"dataNascimento" = $${paramIndex++}`);
      values.push(new Date(dadosAtleta.dataNascimento));
    }
    if (dadosAtleta.categoria !== undefined) {
      updates.push(`categoria = $${paramIndex++}`);
      values.push(dadosAtleta.categoria);
    }
    if (dadosAtleta.genero !== undefined) {
      updates.push(`genero = $${paramIndex++}`);
      values.push(dadosAtleta.genero);
    }
    if (dadosAtleta.fotoUrl !== undefined) {
      updates.push(`"fotoUrl" = $${paramIndex++}`);
      values.push(dadosAtleta.fotoUrl);
    }
    if (dadosAtleta.pointIdPrincipal !== undefined) {
      updates.push(`"pointIdPrincipal" = $${paramIndex++}`);
      values.push(dadosAtleta.pointIdPrincipal);
    }

    if (updates.length > 0) {
      updates.push(`"updatedAt" = NOW()`);
      values.push(atletaId);
      await query(
        `UPDATE "Atleta" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Inserir arenas frequentes se fornecidas
    if (dadosAtleta.pointIdsFrequentes && dadosAtleta.pointIdsFrequentes.length > 0) {
      // Limpar arenas frequentes existentes
      await query('DELETE FROM "AtletaPoint" WHERE "atletaId" = $1', [atletaId]);
      
      // Inserir novas arenas frequentes
      for (const pointId of dadosAtleta.pointIdsFrequentes) {
        await query(
          'INSERT INTO "AtletaPoint" ("atletaId", "pointId", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("atletaId", "pointId") DO NOTHING',
          [atletaId, pointId]
        );
      }
    }
  }

  // Retornar usuário completo
  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, a.id as "atletaId", a.nome, a.fone as telefone
     FROM "User" u
     LEFT JOIN "Atleta" a ON a."usuarioId" = u.id
     WHERE u.id = $1`,
    [usuarioId]
  );

  return result.rows[0];
};

export const atualizarUsuarioAdmin = async (
  id: string,
  dados: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    pointIdGestor?: string | null;
    whatsapp?: string | null;
    aceitaLembretesAgendamento?: boolean;
  }
) => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (dados.name !== undefined && dados.name !== null) {
    updates.push(`name = $${paramIndex++}`);
    values.push(dados.name);
  }
  if (dados.email !== undefined && dados.email !== null) {
    updates.push(`email = $${paramIndex++}`);
    values.push(dados.email.toLowerCase().trim());
  }
  // Processar senha - só atualiza se fornecida e não vazia
  if (dados.password !== undefined && dados.password !== null) {
    const senhaTrimmed = typeof dados.password === 'string' ? dados.password.trim() : '';
    if (senhaTrimmed !== '') {
      const hash = await bcrypt.hash(senhaTrimmed, 10);
      updates.push(`password = $${paramIndex++}`);
      values.push(hash);
      if (process.env.NODE_ENV === 'development') {
        console.log('Hash de senha gerado para atualização do usuário:', id);
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log('Senha vazia - não será atualizada');
    }
  }
  if (dados.role !== undefined && dados.role !== null) {
    updates.push(`role = $${paramIndex++}`);
    values.push(dados.role);
  }
  if (dados.pointIdGestor !== undefined) {
    updates.push(`"pointIdGestor" = $${paramIndex++}`);
    values.push(dados.pointIdGestor);
  }
  if (dados.aceitaLembretesAgendamento !== undefined) {
    updates.push(`"aceitaLembretesAgendamento" = $${paramIndex++}`);
    values.push(dados.aceitaLembretesAgendamento);
  }
  // WhatsApp: coluna não existe ainda na tabela User
  // if (dados.whatsapp !== undefined) {
  //   // Formatar WhatsApp: remover caracteres não numéricos
  //   const whatsappFormatado = dados.whatsapp ? dados.whatsapp.replace(/\D/g, '') : null;
  //   updates.push(`whatsapp = $${paramIndex++}`);
  //   values.push(whatsappFormatado || null);
  // }

  if (updates.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Nenhuma atualização para fazer');
    }
    return null;
  }

  values.push(id);

  if (process.env.NODE_ENV === 'development') {
    console.log('Executando UPDATE com', updates.length, 'campos');
  }

  await query(
    `UPDATE "User" SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  const result = await query(
    'SELECT id, name, email, role, "pointIdGestor", "createdAt" FROM "User" WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};



