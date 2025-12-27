// app/api/agendamento/[id]/solicitar-cancelamento/route.ts - Rota para solicitar cancelamento de agendamento (para atletas com menos de 12h)
import { NextRequest, NextResponse } from 'next/server';
import { query, normalizarDataHora } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { enviarMensagemGzappy } from '@/lib/gzappyService';

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
        p.nome as "point_nome", p.telefone as "point_telefone",
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

    // Normalizar dataHora para string (pode vir como Date do PostgreSQL)
    const dataHoraStr = normalizarDataHora(agendamento.dataHora);
    
    // Verificar se faltam menos de 12 horas
    const dataHoraAgendamento = new Date(dataHoraStr);
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
    const matchDataHora = dataHoraStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    let dataFormatada = '';
    let horaFormatada = '';
    
    if (matchDataHora) {
      const [, ano, mes, dia, hora, minuto] = matchDataHora;
      dataFormatada = `${dia}/${mes}/${ano}`;
      horaFormatada = `${hora}:${minuto}`;
    } else {
      // Fallback: tentar formatar diretamente do Date
      try {
        const dataHoraDate = new Date(dataHoraStr);
        if (!isNaN(dataHoraDate.getTime())) {
          const dia = String(dataHoraDate.getDate()).padStart(2, '0');
          const mes = String(dataHoraDate.getMonth() + 1).padStart(2, '0');
          const ano = dataHoraDate.getFullYear();
          const hora = String(dataHoraDate.getHours()).padStart(2, '0');
          const minuto = String(dataHoraDate.getMinutes()).padStart(2, '0');
          dataFormatada = `${dia}/${mes}/${ano}`;
          horaFormatada = `${hora}:${minuto}`;
        }
      } catch (error) {
        console.error('Erro ao formatar data/hora:', error);
      }
    }

    // Obter nome do cliente
    const clienteNome = agendamento.atleta_nome || agendamento.usuario_name || 'Cliente';
    const clienteTelefone = agendamento.atleta_fone || '';

    // Usar telefone da arena (Point) como WhatsApp
    const telefoneArena = agendamento.point_telefone;
    
    if (!telefoneArena) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Telefone da arena não está cadastrado' },
        { status: 500 }
      );
      return withCors(errorResponse, request);
    }

    // Formatar número do WhatsApp (remover caracteres não numéricos e adicionar 55 se necessário)
    let numeroFormatado = telefoneArena.replace(/\D/g, '');
    if (!numeroFormatado.startsWith('55')) {
      numeroFormatado = '55' + numeroFormatado;
    }
    
    // Usar nome da arena como destinatário
    const gestorNome = agendamento.point_nome || 'Arena';

    // Criar mensagem de solicitação de cancelamento
    const horasRestantes = Math.floor(diferencaHoras);
    const minutosRestantes = Math.floor((diferencaHoras - horasRestantes) * 60);
    const tempoRestante = horasRestantes > 0 
      ? `${horasRestantes}h ${minutosRestantes > 0 ? minutosRestantes + 'min' : ''}`.trim()
      : `${minutosRestantes}min`;

    const mensagem = `🏟️ *Solicitação de Cancelamento de Agendamento*

Olá ${gestorNome},

O atleta *${clienteNome}*${clienteTelefone ? ` (${clienteTelefone})` : ''} está solicitando o cancelamento do seguinte agendamento:

📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}
🏸 *Quadra:* ${agendamento.quadra_nome}
🏢 *Arena:* ${agendamento.point_nome}

⚠️ *Motivo da Solicitação:*
O cancelamento foi solicitado porque faltam menos de 12 horas para o início do agendamento (restam aproximadamente ${tempoRestante}).

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

