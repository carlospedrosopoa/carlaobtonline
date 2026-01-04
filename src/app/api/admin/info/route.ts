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

    // Extrair nome do banco de dados da DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL || '';
    let databaseName = 'N/A';
    
    if (databaseUrl) {
      try {
        // Formato: postgresql://user:pass@host:port/dbname?params
        const urlMatch = databaseUrl.match(/postgresql:\/\/[^@]+@[^/]+\/([^?]+)/);
        if (urlMatch && urlMatch[1]) {
          databaseName = urlMatch[1];
        }
      } catch (error) {
        console.error('Erro ao extrair nome do banco:', error);
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

