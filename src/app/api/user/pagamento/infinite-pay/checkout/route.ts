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
    const { cardId, valor, orderId, descricao, parcelas, cpf } = body;

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

    // Buscar CPF do atleta para o Infinite Pay
    // Se o CPF foi fornecido no body, usar ele. Caso contrário, tentar buscar do perfil do atleta
    let docNumber = '';
    
    if (cpf && cpf.replace(/\D/g, '').length === 11) {
      // CPF fornecido pelo frontend
      docNumber = cpf.replace(/\D/g, '');
    } else {
      // Tentar buscar CPF do perfil do atleta (quando o campo for adicionado)
      // Por enquanto, usar variável de ambiente como fallback
      docNumber = process.env.INFINITE_PAY_DEFAULT_DOC || '';
      
      // TODO: Quando o campo CPF for adicionado ao perfil do atleta, buscar aqui
      // const atletaData = await query(
      //   'SELECT cpf FROM "Atleta" WHERE "usuarioId" = $1',
      //   [user.id]
      // );
      // docNumber = atletaData.rows[0]?.cpf?.replace(/\D/g, '') || '';
    }

    if (!docNumber || docNumber.length !== 11) {
      const errorResponse = NextResponse.json(
        { mensagem: 'CPF é obrigatório para processar o pagamento. Por favor, informe seu CPF.' },
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

    // Gerar link de checkout usando a API oficial do Infinite Pay
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://appatleta.playnaquadra.com.br'}/app/atleta/consumo?payment_callback=${orderId}`;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://appatleta.playnaquadra.com.br'}/api/user/pagamento/infinite-pay/callback`;

    // Montar payload conforme documentação oficial do Infinite Pay
    const payload: any = {
      handle: infinitePayHandle,
      order_nsu: orderId,
      itens: [
        {
          quantity: 1,
          price: Math.round(valor * 100), // Valor em centavos
          description: descricao || `Pagamento Card #${card.numeroCard || ''}`,
        },
      ],
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
    };

    // Adicionar dados do cliente se disponível
    // O CPF pode ser enviado no customer conforme documentação
    if (docNumber) {
      // Buscar dados do atleta para preencher informações do cliente
      const atletaData = await query(
        'SELECT nome, fone FROM "Atleta" WHERE "usuarioId" = $1 LIMIT 1',
        [user.id]
      );

      if (atletaData.rows.length > 0) {
        const atleta = atletaData.rows[0];
        const userData = await query(
          'SELECT email FROM "User" WHERE id = $1 LIMIT 1',
          [user.id]
        );

        // Usar nome do atleta ou nome do user (que está em user.nome)
        payload.customer = {
          name: atleta.nome || user.nome || '',
          email: userData.rows[0]?.email || '',
          phone_number: atleta.fone ? `+55${atleta.fone.replace(/\D/g, '')}` : '',
          cpf: docNumber, // Adicionar CPF no customer
        };
      } else {
        // Se não tiver atleta, criar customer apenas com CPF
        const userData = await query(
          'SELECT email FROM "User" WHERE id = $1 LIMIT 1',
          [user.id]
        );
        
        payload.customer = {
          name: user.nome || '',
          email: userData.rows[0]?.email || '',
          cpf: docNumber,
        };
      }
    }

    // Fazer requisição para a API do Infinite Pay
    try {
      console.log('[INFINITE PAY] Payload enviado:', JSON.stringify(payload, null, 2));
      
      const infinitePayResponse = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[INFINITE PAY] Status da resposta:', infinitePayResponse.status);
      console.log('[INFINITE PAY] Headers da resposta:', Object.fromEntries(infinitePayResponse.headers.entries()));

      if (!infinitePayResponse.ok) {
        const errorText = await infinitePayResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        console.error('[INFINITE PAY] Erro na API:', {
          status: infinitePayResponse.status,
          statusText: infinitePayResponse.statusText,
          error: errorData
        });
        const errorResponse = NextResponse.json(
          { 
            mensagem: 'Erro ao gerar link de pagamento no Infinite Pay',
            error: process.env.NODE_ENV === 'development' ? errorData : undefined,
            status: infinitePayResponse.status
          },
          { status: 500 }
        );
        return withCors(errorResponse, request);
      }

      const infinitePayData = await infinitePayResponse.json();
      console.log('[INFINITE PAY] Resposta completa:', JSON.stringify(infinitePayData, null, 2));

      // A resposta da API do Infinite Pay deve conter o link de checkout
      // Verificar a estrutura da resposta conforme documentação
      const checkoutUrl = infinitePayData.checkout_url || infinitePayData.url || infinitePayData.link || infinitePayData.checkoutUrl;

      if (!checkoutUrl) {
        console.error('[INFINITE PAY] Resposta sem checkout_url. Estrutura completa:', infinitePayData);
        const errorResponse = NextResponse.json(
          { 
            mensagem: 'Resposta inválida do Infinite Pay - link de checkout não encontrado',
            error: process.env.NODE_ENV === 'development' ? infinitePayData : undefined
          },
          { status: 500 }
        );
        return withCors(errorResponse, request);
      }
      
      console.log('[INFINITE PAY] Checkout URL gerado:', checkoutUrl);

      const response = NextResponse.json({
        success: true,
        checkoutUrl,
        orderId,
      });

      return withCors(response, request);
    } catch (error: any) {
      console.error('[INFINITE PAY] Erro ao chamar API:', error);
      const errorResponse = NextResponse.json(
        { 
          mensagem: 'Erro ao comunicar com Infinite Pay',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }
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

