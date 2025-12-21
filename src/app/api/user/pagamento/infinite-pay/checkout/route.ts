// app/api/user/pagamento/infinite-pay/checkout/route.ts - Criar checkout Infinite Pay
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { query } from '@/lib/db';
import { verificarAtletaUsuario } from '@/lib/atletaService';

// POST /api/user/pagamento/infinite-pay/checkout - Criar checkout Infinite Pay
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return withCors(authResult, request);
    }

    const { user } = authResult;
    const body = await request.json();
    const { cardId, valor, orderId, descricao, parcelas } = body;

    // Validações
    if (!cardId || !valor || !orderId) {
      const errorResponse = NextResponse.json(
        { mensagem: 'cardId, valor e orderId são obrigatórios' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    if (valor <= 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Valor deve ser maior que zero' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar atleta do usuário
    const atleta = await verificarAtletaUsuario(user.id);
    if (!atleta) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você ainda não possui um perfil de atleta' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o card existe e pertence ao usuário, e buscar dados da arena
    const cardCheck = await query(
      `SELECT c.id, c."usuarioId", c.status, c."valorTotal", c."numeroCard", c."pointId",
              COALESCE(SUM(p.valor), 0) as "totalPago",
              pt."infinitePayHandle"
       FROM "CardCliente" c
       INNER JOIN "Point" pt ON pt.id = c."pointId"
       LEFT JOIN "PagamentoCard" p ON p."cardId" = c.id
       WHERE c.id = $1
       GROUP BY c.id, c."numeroCard", c."pointId", pt."infinitePayHandle"`,
      [cardId]
    );

    if (cardCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Card não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const card = cardCheck.rows[0];
    
    // Verificar se o card pertence ao usuário
    if (card.usuarioId !== user.id) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para pagar este card' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o card está aberto
    if (card.status !== 'ABERTO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Este card não está aberto para pagamento' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Calcular saldo
    const totalPago = parseFloat(card.totalPago) || 0;
    const saldo = parseFloat(card.valorTotal) - totalPago;

    // Verificar se o valor a pagar não excede o saldo
    if (valor > saldo) {
      const errorResponse = NextResponse.json(
        { mensagem: `Valor excede o saldo pendente de ${saldo.toFixed(2)}` },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar CPF do usuário para o Infinite Pay
    // O CPF pode estar em um campo específico ou precisar ser coletado do perfil
    // Por enquanto, vamos usar o email como fallback ou solicitar que seja informado
    // TODO: Adicionar campo CPF na tabela User ou Atleta se necessário
    
    // Buscar dados do usuário
    const userData = await query(
      'SELECT email, name FROM "User" WHERE id = $1',
      [user.id]
    );

    // Por enquanto, vamos usar um placeholder ou solicitar CPF
    // Em produção, o CPF deve estar cadastrado no perfil do usuário/atleta
    const docNumber = process.env.INFINITE_PAY_DEFAULT_DOC || ''; // CPF padrão para testes

    if (!docNumber || docNumber.length < 11) {
      const errorResponse = NextResponse.json(
        { mensagem: 'CPF não configurado. Entre em contato com o suporte.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar handle do Infinite Pay da arena
    const infinitePayHandle = card.infinitePayHandle;

    if (!infinitePayHandle) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Esta arena ainda não configurou o Infinite Pay. Entre em contato com a administração da arena.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Criar registro de pagamento pendente
    await query(
      `INSERT INTO "PagamentoInfinitePay" (id, "cardId", "orderId", valor, parcelas, status, "createdAt", "createdBy")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'PENDING', NOW(), $5)
       ON CONFLICT ("orderId") DO UPDATE SET
         valor = EXCLUDED.valor,
         parcelas = EXCLUDED.parcelas,
         "updatedAt" = NOW()`,
      [cardId, orderId, valor, parcelas || 1, user.id]
    );

    // Gerar DeepLink do Infinite Pay
    const resultUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://appatleta.playnaquadra.com.br'}/app/atleta/consumo?payment_callback=${orderId}`;
    
    const deeplinkParams = new URLSearchParams();
    deeplinkParams.append('handle', infinitePayHandle);
    deeplinkParams.append('doc_number', docNumber);
    deeplinkParams.append('amount', (valor * 100).toString()); // Converter para centavos
    deeplinkParams.append('order_id', orderId);
    deeplinkParams.append('description', descricao || `Pagamento Card #${card.numeroCard || ''}`);
    deeplinkParams.append('result_url', resultUrl);
    
    if (parcelas && parcelas > 1) {
      deeplinkParams.append('installments', parcelas.toString());
      deeplinkParams.append('payment_method', 'credit');
    } else {
      deeplinkParams.append('payment_method', 'pix'); // PIX para pagamento à vista
    }

    const deeplink = `infinitepay://checkout?${deeplinkParams.toString()}`;

    const response = NextResponse.json({
      success: true,
      deeplink,
      orderId,
    });

    return withCors(response, request);
  } catch (error: any) {
    console.error('[INFINITE PAY CHECKOUT] Erro:', error);
    const errorResponse = NextResponse.json(
      { 
        mensagem: 'Erro ao criar checkout',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

