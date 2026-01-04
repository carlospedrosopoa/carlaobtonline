// app/api/admin/info/route.ts - Informações do sistema para admin
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    
    // Apenas ADMIN pode acessar essas informações
    if (user.role !== 'ADMIN') {
      const errorResponse = NextResponse.json(
        { mensagem: "Acesso negado" },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Extrair informações do banco de dados da DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL || '';
    let databaseName = 'N/A';
    let neonEndpoint = 'N/A';
    let neonBranch = 'N/A';
    
    // Obter nome do branch do Neon (se definido via variável de ambiente)
    if (process.env.NEON_BRANCH_NAME) {
      neonBranch = process.env.NEON_BRANCH_NAME;
    }
    
    if (databaseUrl) {
      try {
        // Formato: postgresql://user:pass@host:port/dbname?params
        // Exemplo Neon: postgresql://user:pass@ep-restless-surf-a81v69f3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require
        const urlMatch = databaseUrl.match(/postgresql:\/\/(?:[^@]+)@([^\/]+)\/([^?]+)/);
        if (urlMatch) {
          // Extrair host/endpoint
          const host = urlMatch[1];
          if (host) {
            // Para Neon, o endpoint geralmente é algo como: ep-xxxxx-pooler.region.azure.neon.tech
            // Podemos extrair apenas o identificador principal (ep-xxxxx)
            const endpointMatch = host.match(/^(ep-[^-]+)/);
            if (endpointMatch && endpointMatch[1]) {
              neonEndpoint = endpointMatch[1];
            } else {
              // Se não for formato Neon, usar o host completo
              neonEndpoint = host.split(':')[0]; // Remove porta se existir
            }
          }
          // Extrair nome do banco
          const dbName = urlMatch[2];
          if (dbName) {
            databaseName = dbName;
          }
        }
      } catch (error) {
        console.error('Erro ao extrair informações do banco:', error);
      }
    }

    // Obter branch atual
    let gitBranch = 'N/A';
    try {
      // Prioridade 1: Variável de ambiente do Vercel
      if (process.env.VERCEL_GIT_COMMIT_REF) {
        gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
      } else if (process.env.GIT_BRANCH) {
        // Prioridade 2: Variável de ambiente customizada
        gitBranch = process.env.GIT_BRANCH;
      } else {
        // Prioridade 3: Tentar ler do git diretamente (apenas em desenvolvimento/local)
        try {
          // Tenta executar git rev-parse --abbrev-ref HEAD
          const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            cwd: process.cwd(),
          }).trim();
          if (branch) {
            gitBranch = branch;
          }
        } catch (gitError) {
          // Se falhar, tenta ler do arquivo .git/HEAD (alternativa)
          try {
            const gitHeadPath = join(process.cwd(), '.git', 'HEAD');
            const headContent = readFileSync(gitHeadPath, 'utf8').trim();
            const branchMatch = headContent.match(/refs\/heads\/(.+)/);
            if (branchMatch && branchMatch[1]) {
              gitBranch = branchMatch[1];
            }
          } catch (fileError) {
            // Ignora erro ao ler arquivo
          }
        }
      }
    } catch (error) {
      console.error('Erro ao obter branch:', error);
    }

    const info = {
      databaseName,
      neonEndpoint,
      neonBranch,
      gitBranch,
      environment: process.env.NODE_ENV || 'development',
    };

    const response = NextResponse.json(info, {
      headers: {
        'Cache-Control': 'no-store',
      }
    });
    return withCors(response, request);
  } catch (error) {
    console.error('Erro ao obter informações do sistema:', error);
    const errorResponse = NextResponse.json(
      { mensagem: "Erro ao obter informações do sistema" },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

