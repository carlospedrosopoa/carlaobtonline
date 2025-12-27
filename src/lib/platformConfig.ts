// lib/platformConfig.ts - Gerenciamento de configurações da plataforma
import { query } from './db';

export interface PlatformConfig {
  id: number;
  chave: string;
  valor: string | null;
  descricao: string | null;
  tipo: 'texto' | 'numero' | 'booleano' | 'json';
  categoria: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Obtém uma configuração da plataforma por chave
 */
export async function obterConfiguracao(chave: string): Promise<string | null> {
  try {
    const result = await query(
      'SELECT "valor" FROM "PlatformConfig" WHERE "chave" = $1',
      [chave]
    );

    if (result.rows.length > 0) {
      return result.rows[0].valor;
    }

    return null;
  } catch (error: any) {
    console.error('Erro ao obter configuração da plataforma:', error);
    return null;
  }
}

/**
 * Obtém uma configuração da plataforma com todos os dados
 */
export async function obterConfiguracaoCompleta(chave: string): Promise<PlatformConfig | null> {
  try {
    const result = await query(
      'SELECT * FROM "PlatformConfig" WHERE "chave" = $1',
      [chave]
    );

    if (result.rows.length > 0) {
      return result.rows[0] as PlatformConfig;
    }

    return null;
  } catch (error: any) {
    console.error('Erro ao obter configuração completa da plataforma:', error);
    return null;
  }
}

/**
 * Define uma configuração da plataforma
 */
export async function definirConfiguracao(
  chave: string,
  valor: string,
  descricao?: string,
  tipo: PlatformConfig['tipo'] = 'texto',
  categoria: string = 'geral'
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO "PlatformConfig" ("chave", "valor", "descricao", "tipo", "categoria", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("chave") 
       DO UPDATE SET "valor" = $2, "descricao" = $3, "tipo" = $4, "categoria" = $5, "updatedAt" = NOW()`,
      [chave, valor, descricao || null, tipo, categoria]
    );

    return true;
  } catch (error: any) {
    console.error('Erro ao definir configuração da plataforma:', error);
    return false;
  }
}

/**
 * Obtém todas as configurações de uma categoria
 */
export async function obterConfiguracoesPorCategoria(categoria: string): Promise<PlatformConfig[]> {
  try {
    const result = await query(
      'SELECT * FROM "PlatformConfig" WHERE "categoria" = $1 ORDER BY "chave"',
      [categoria]
    );

    return result.rows as PlatformConfig[];
  } catch (error: any) {
    console.error('Erro ao obter configurações por categoria:', error);
    return [];
  }
}

/**
 * Obtém todas as configurações da plataforma
 */
export async function obterTodasConfiguracoes(): Promise<PlatformConfig[]> {
  try {
    const result = await query(
      'SELECT * FROM "PlatformConfig" ORDER BY "categoria", "chave"'
    );

    return result.rows as PlatformConfig[];
  } catch (error: any) {
    console.error('Erro ao obter todas as configurações:', error);
    return [];
  }
}

/**
 * Obtém configurações do Gzappy da plataforma
 */
export async function obterConfiguracoesGzappyPlataforma(): Promise<{
  apiKey: string | null;
  instanceId: string | null;
  ativo: boolean;
}> {
  try {
    const apiKey = await obterConfiguracao('gzappy_api_key');
    const instanceId = await obterConfiguracao('gzappy_instance_id');
    const ativoStr = await obterConfiguracao('gzappy_ativo');

    return {
      apiKey: apiKey?.trim() || null,
      instanceId: instanceId?.trim() || null,
      ativo: ativoStr === 'true',
    };
  } catch (error: any) {
    console.error('Erro ao obter configurações Gzappy da plataforma:', error);
    return {
      apiKey: null,
      instanceId: null,
      ativo: false,
    };
  }
}

