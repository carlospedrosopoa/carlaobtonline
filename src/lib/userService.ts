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

export const atualizarUsuarioAdmin = async (
  id: string,
  dados: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    pointIdGestor?: string | null;
    whatsapp?: string | null;
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



