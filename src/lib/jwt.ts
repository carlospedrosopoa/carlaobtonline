// lib/jwt.ts - Funções para geração e validação de JWT
import jwt, { SignOptions } from 'jsonwebtoken';

// Chave secreta para assinar tokens (deve estar em variável de ambiente)
const JWT_SECRET: string = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura-mude-em-producao';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d'; // 7 dias por padrão
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '30d'; // 30 dias para refresh token

export interface JwtPayload {
  id: string;
  email: string;
  nome: string;
  role: string;
  atletaId?: string | null;
  pointIdGestor?: string | null;
  ehColaborador?: boolean | null;
  gestorId?: string | null;
  iat?: number;
  exp?: number;
}

/**
 * Gera um token JWT de acesso
 */
export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

/**
 * Gera um refresh token (válido por mais tempo)
 */
export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, type: 'refresh' } as object, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

/**
 * Verifica e decodifica um token JWT
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Token expirado');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('Token inválido');
    } else {
      console.error('Erro ao verificar token:', error);
    }
    return null;
  }
}

/**
 * Decodifica um token sem verificar (útil para debug, não usar para autenticação)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
}

