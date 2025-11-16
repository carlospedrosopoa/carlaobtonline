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
}) {
  const id = uuidv4();
  const dataNasc = new Date(dados.dataNascimento);
  
  await query(
    'INSERT INTO "Atleta" (id, nome, "dataNascimento", categoria, genero, fone, "fotoUrl", "usuarioId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
    [id, dados.nome, dataNasc, dados.categoria || null, dados.genero || null, dados.fone || null, dados.fotoUrl || null, usuarioId]
  );
  
  const result = await query('SELECT * FROM "Atleta" WHERE id = $1', [id]);
  const atleta = result.rows[0];
  
  return {
    ...atleta,
    idade: calcularIdade(atleta.dataNascimento),
  };
}

export async function listarAtletas(usuario: { id: string; role: string }) {
  const result = usuario.role === "ADMIN"
    ? await query(
        `SELECT a.*, u.name as "usuarioName", u.role as "usuarioRole" 
         FROM "Atleta" a 
         LEFT JOIN "User" u ON a."usuarioId" = u.id 
         ORDER BY a.nome ASC`,
        []
      )
    : await query(
        `SELECT a.*, u.name as "usuarioName", u.role as "usuarioRole" 
         FROM "Atleta" a 
         LEFT JOIN "User" u ON a."usuarioId" = u.id 
         WHERE a."usuarioId" = $1
         ORDER BY a.nome ASC`,
        [usuario.id]
      );
      
  const atletas = result.rows.map((row: any) => ({
    ...row,
    usuario: row.usuarioName ? { name: row.usuarioName, role: row.usuarioRole } : null,
    idade: calcularIdade(row.dataNascimento),
  }));

  return {
    atletas,
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
  
  const atleta = result.rows[0];
  return {
    ...atleta,
    usuario: atleta.usuarioName ? { name: atleta.usuarioName, role: atleta.usuarioRole } : null,
    idade: calcularIdade(atleta.dataNascimento),
  };
}

