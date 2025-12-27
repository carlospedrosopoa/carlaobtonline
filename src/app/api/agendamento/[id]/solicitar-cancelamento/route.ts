// app/api/agendamento/[id]/solicitar-cancelamento/route.ts - Rota para solicitar cancelamento de agendamento (para atletas com menos de 12h)
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { enviarMensagemGzappy, obterWhatsAppGestor } from '@/lib/gzappyService';

// POST /api/agendamento/[id]/solicitar-cancelamento - Solicitar cancelamento de agendamento
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o agendamento existe
    const agendamentoCheck = await query(
      `SELECT 
        a.id, a."usuarioId", a."atletaId", a."quadraId", a.status, a."dataHora",
        q.nome as "quadra_nome", q."pointId" as "quadra_pointId",
        p.nome as "point_nome",
        at.nome as "atleta_nome", at.fone as "atleta_fone",
        u.name as "usuario_name", u.email as "usuario_email"
      FROM "Agendamento" a
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      LEFT JOIN "Point" p ON q."pointId" = p.id
      LEFT JOIN "Atleta" at ON a."atletaId" = at.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      WHERE a.id = $1`,
      [id]
    );

    if (agendamentoCheck.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const agendamento = agendamentoCheck.rows[0];
    
    if (agendamento.status === 'CANCELADO') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Agendamento já está cancelado' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o usuário tem permissão (apenas USER pode solicitar cancelamento)
    if (usuario.role !== 'USER') {
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas atletas podem solicitar cancelamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se o agendamento pertence ao usuário ou ao atleta do usuário
    const pertenceAoUsuario = agendamento.usuarioId === usuario.id || 
                              (agendamento.atletaId && agendamento.atletaId === usuario.id);

    if (!pertenceAoUsuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você não tem permissão para solicitar cancelamento deste agendamento' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar se faltam menos de 12 horas
    const dataHoraAgendamento = new Date(agendamento.dataHora);
    const agora = new Date();
    const diferencaMs = dataHoraAgendamento.getTime() - agora.getTime();
    const diferencaHoras = diferencaMs / (1000 * 60 * 60);

    if (diferencaHoras >= 12) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Você pode cancelar diretamente. Faltam mais de 12 horas para o agendamento.' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Extrair data e hora para formatação
    const matchDataHora = agendamento.dataHora.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    let dataFormatada = '';
    let horaFormatada = '';
    
    if (matchDataHora) {
      const [, ano, mes, dia, hora, minuto] = matchDataHora;
      dataFormatada = `${dia}/${mes}/${ano}`;
      horaFormatada = `${hora}:${minuto}`;
    }

    // Obter nome do cliente
    const clienteNome = agendamento.atleta_nome || agendamento.usuario_name || 'Cliente';
    const clienteTelefone = agendamento.atleta_fone || '';

    // Buscar WhatsApp do gestor da arena
    const gestorWhatsapp = await obterWhatsAppGestor(agendamento.quadra_pointId);
    
    if (!gestorWhatsapp) {
      const errorResponse = NextResponse.json(
        { mensagem: 'WhatsApp do gestor não está cadastrado' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }
    
    // Buscar nome do gestor para personalizar a mensagem
    const gestorResult = await query(
      `SELECT u.name as "gestor_nome", u.email as "gestor_email"
       FROM "User" u 
       WHERE u.role = 'ORGANIZER' 
       AND u."pointIdGestor" = $1 
       LIMIT 1`,
      [agendamento.quadra_pointId]
    );
    
    const gestorNome = gestorResult.rows.length > 0 
      ? (gestorResult.rows[0].gestor_nome || gestorResult.rows[0].gestor_email || 'Gestor')
      : 'Gestor';

    // Formatar número do WhatsApp (remover caracteres não numéricos e adicionar 55 se necessário)
    let numeroFormatado = gestorWhatsapp.replace(/\D/g, '');
    if (!numeroFormatado.startsWith('55')) {
      numeroFormatado = '55' + numeroFormatado;
    }

    // Criar mensagem de solicitação de cancelamento
    const mensagem = `🏟️ *Solicitação de Cancelamento de Agendamento*

Olá ${gestorNome},

O atleta *${clienteNome}*${clienteTelefone ? ` (${clienteTelefone})` : ''} está solicitando o cancelamento do seguinte agendamento:

📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}
🏸 *Quadra:* ${agendamento.quadra_nome}
🏢 *Arena:* ${agendamento.point_nome}

⚠️ *Atenção:* Faltam menos de 12 horas para o início do agendamento.

Por favor, entre em contato com o atleta para confirmar ou negar o cancelamento.`;

    // Enviar mensagem via Gzappy
    const enviado = await enviarMensagemGzappy(
      {
        destinatario: numeroFormatado,
        mensagem: mensagem,
      },
      agendamento.quadra_pointId
    );

    if (!enviado) {
      console.error('Erro ao enviar mensagem Gzappy para solicitação de cancelamento');
      // Não falhar a requisição, apenas logar o erro
    }

    const response = NextResponse.json({
      mensagem: 'Solicitação de cancelamento enviada para a arena com sucesso',
      enviado: enviado,
    });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao solicitar cancelamento de agendamento:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao solicitar cancelamento de agendamento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

