// lib/userService.ts
import { query } from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const createUser = async (
  name: string,
  email: string,
  password: string
) => {
  if (!name || !email || !password) {
    throw new Error("name, email e password são obrigatórios");
  }

  const exists = await query('SELECT id FROM "User" WHERE email = $1', [email.toLowerCase().trim()]);
  if (exists.rows.length > 0) {
    throw new Error("E-mail já cadastrado");
  }

  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  await query(
    'INSERT INTO "User" (id, name, email, password, role, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
    [id, name, email.toLowerCase().trim(), hash, 'USER']
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
    'SELECT id, name, email, role FROM "User" WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

