// app/api/user/verificacao/validar-codigo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';
import {
  obterCodigoVerificacao,
  removerCodigoVerificacao,
} from '@/lib/verificacaoService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telefone, codigo } = body;

    if (!telefone || !codigo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Telefone e código são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Normalizar telefone
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Buscar código armazenado
    const dadosCodigo = obterCodigoVerificacao(telefoneNormalizado);

    if (!dadosCodigo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Código não encontrado ou expirado. Solicite um novo código.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Validar código
    if (dadosCodigo.codigo !== codigo) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Código inválido. Verifique e tente novamente.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Código válido - remover do armazenamento
    removerCodigoVerificacao(telefoneNormalizado);

    const response = NextResponse.json({
      mensagem: 'Código validado com sucesso',
      valido: true,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao validar código:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao validar código. Tente novamente.' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

