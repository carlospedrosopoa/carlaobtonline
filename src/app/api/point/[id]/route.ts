// app/api/point/[id]/route.ts - Rotas de API para Point individual (GET, PUT, DELETE)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUsuarioFromRequest } from '@/lib/auth';
import { withCors } from '@/lib/cors';
import { uploadImage, base64ToBuffer, deleteImage } from '@/lib/googleCloudStorage';

// GET /api/point/[id] - Obter point por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
      return withCors(errorResponse, request);
    }

    const { id } = await params;
    // Tentar primeiro com todos os campos (WhatsApp, Gzappy, cardTemplateUrl)
    let result;
    try {
      result = await query(
        `SELECT 
          id, nome, endereco, telefone, email, descricao, "logoUrl", "pixChave", "cardTemplateUrl", latitude, longitude, ativo,
          "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
          "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
          "enviarLembretesAgendamento", "antecedenciaLembrete",
          "pagamentoOnlineAtivo",
          "infinitePayHandle",
          "pagBankAtivo", "pagBankEnv", "pagBankToken", "pagBankWebhookToken",
          assinante, "createdAt", "updatedAt"
        FROM "Point"
        WHERE id = $1`,
        [id]
      );
    } catch (error: any) {
      // Se falhar (colunas não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('cardTemplateUrl') || error.message?.includes('column') || error.code === '42703') {
        console.log('⚠️ Alguns campos não encontrados, usando query básica');
        try {
          // Tentar com cardTemplateUrl
          result = await query(
            `SELECT 
              id, nome, endereco, telefone, email, descricao, "logoUrl", "pixChave", "cardTemplateUrl", latitude, longitude, ativo,
              assinante, "createdAt", "updatedAt"
            FROM "Point"
            WHERE id = $1`,
            [id]
          );
        } catch (error2: any) {
          // Se ainda falhar, tentar sem cardTemplateUrl
          if (error2.message?.includes('cardTemplateUrl') || error2.code === '42703') {
            console.log('⚠️ Campo cardTemplateUrl não encontrado, usando query sem ele');
            result = await query(
              `SELECT 
                id, nome, endereco, telefone, email, descricao, "logoUrl", "pixChave", latitude, longitude, ativo,
                assinante, "createdAt", "updatedAt"
              FROM "Point"
              WHERE id = $1`,
              [id]
            );
          } else {
            throw error2;
          }
        }
        // Adicionar campos faltantes como null para compatibilidade
        if (result.rows.length > 0) {
          result.rows[0] = {
            ...result.rows[0],
            pixChave: result.rows[0].pixChave ?? null,
            cardTemplateUrl: result.rows[0].cardTemplateUrl ?? null,
            whatsappAccessToken: null,
            whatsappPhoneNumberId: null,
            whatsappBusinessAccountId: null,
            whatsappApiVersion: 'v21.0',
            whatsappAtivo: false,
            gzappyApiKey: null,
            gzappyInstanceId: null,
            gzappyAtivo: false,
            enviarLembretesAgendamento: false,
            antecedenciaLembrete: 8,
            infinitePayHandle: null,
            pagBankAtivo: false,
            pagBankEnv: null,
            pagBankToken: null,
            pagBankWebhookToken: null,
            pagamentoOnlineAtivo: false,
            assinante: result.rows[0].assinante ?? false,
          };
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao obter point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao obter estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// PUT /api/point/[id] - Atualizar point
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extrair id dos params primeiro
    const { id } = await params;
    
    // Verificar autenticação
    const usuario = await getUsuarioFromRequest(request);
    if (!usuario) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não autenticado' },
        { status: 401 }
      );
      return withCors(errorResponse, request);
    }

    // Verificar permissões: ADMIN pode atualizar qualquer point, ORGANIZER apenas sua própria arena
    if (usuario.role === 'ADMIN') {
      // ADMIN pode atualizar qualquer point - sem restrição
    } else if (usuario.role === 'ORGANIZER') {
      // ORGANIZER só pode atualizar sua própria arena (pointIdGestor)
      if (usuario.pointIdGestor !== id) {
        const errorResponse = NextResponse.json(
          { mensagem: 'Você só pode atualizar as configurações da sua própria arena' },
          { status: 403 }
        );
        return withCors(errorResponse, request);
      }
    } else {
      // USER não pode atualizar
      const errorResponse = NextResponse.json(
        { mensagem: 'Apenas administradores e gestores podem atualizar estabelecimentos' },
        { status: 403 }
      );
      return withCors(errorResponse, request);
    }

    const body = await request.json();
    
    // Para ORGANIZER, apenas permitir atualizar campos de configuração (não campos administrativos)
    // ADMIN pode atualizar tudo
    const isOrganizer = usuario.role === 'ORGANIZER';
    
    const { 
      nome, endereco, telefone, email, descricao, logoUrl, cardTemplateUrl, pixChave, latitude, longitude, ativo,
      whatsappAccessToken, whatsappPhoneNumberId, whatsappBusinessAccountId, whatsappApiVersion, whatsappAtivo,
      gzappyApiKey, gzappyInstanceId, gzappyAtivo,
      enviarLembretesAgendamento, antecedenciaLembrete,
      infinitePayHandle,
      pagBankAtivo,
      pagBankEnv,
      pagBankToken,
      pagBankWebhookToken,
      pagamentoOnlineAtivo
    } = body;

    // ORGANIZER não pode alterar campos administrativos
    if (isOrganizer) {
      // Ignorar campos que ORGANIZER não pode alterar
      const camposRestritos = ['ativo', 'assinante', 'whatsappAccessToken', 'whatsappPhoneNumberId', 
                                'whatsappBusinessAccountId', 'whatsappApiVersion', 'whatsappAtivo',
                               'gzappyApiKey', 'gzappyInstanceId', 'gzappyAtivo', 'infinitePayHandle',
                               'pagBankAtivo', 'pagBankEnv', 'pagBankToken', 'pagBankWebhookToken'];
      // Esses campos serão ignorados na atualização para ORGANIZER
    }

    if (!nome) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Nome é obrigatório' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    // Buscar point existente para verificar logo e template antigos
    const pointExistente = await query(
      `SELECT "logoUrl", "cardTemplateUrl" FROM "Point" WHERE id = $1`,
      [id]
    );

    // Processar logoUrl: se for base64, fazer upload para GCS
    let logoUrlProcessada: string | null | undefined = undefined;
    if (logoUrl !== undefined) {
      if (logoUrl === null) {
        // Se for null, deletar logo antigo se existir
        if (pointExistente.rows.length > 0 && pointExistente.rows[0].logoUrl) {
          const logoAntigo = pointExistente.rows[0].logoUrl;
          if (logoAntigo && logoAntigo.startsWith('https://storage.googleapis.com/')) {
            try {
              await deleteImage(logoAntigo);
            } catch (error) {
              console.error('Erro ao deletar logo antigo:', error);
            }
          }
        }
        logoUrlProcessada = null;
      } else if (logoUrl.startsWith('data:image/')) {
        // Se for base64, fazer upload
        try {
          const buffer = base64ToBuffer(logoUrl);
          const mimeMatch = logoUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'jpg';
          const fileName = `point-logo-${id}-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'points');
          
          // Deletar logo antigo se existir
          if (pointExistente.rows.length > 0 && pointExistente.rows[0].logoUrl) {
            const logoAntigo = pointExistente.rows[0].logoUrl;
            if (logoAntigo && logoAntigo.startsWith('https://storage.googleapis.com/')) {
              try {
                await deleteImage(logoAntigo);
              } catch (error) {
                console.error('Erro ao deletar logo antigo:', error);
              }
            }
          }
          
          logoUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload do logo:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload do logo' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // Se já for uma URL, manter como está
        logoUrlProcessada = logoUrl;
      } else {
        logoUrlProcessada = null;
      }
    }

    // Usar logoUrlProcessada se foi processado, senão usar logoUrl original ou manter o atual
    const logoUrlFinal = logoUrlProcessada !== undefined 
      ? logoUrlProcessada 
      : (logoUrl !== undefined ? logoUrl : (pointExistente.rows.length > 0 ? pointExistente.rows[0].logoUrl : null));

    // Processar cardTemplateUrl: se for base64, fazer upload para GCS
    let cardTemplateUrlProcessada: string | null | undefined = undefined;
    if (cardTemplateUrl !== undefined) {
      if (cardTemplateUrl === null) {
        // Se for null, deletar template antigo se existir
        if (pointExistente.rows.length > 0 && pointExistente.rows[0].cardTemplateUrl) {
          const templateAntigo = pointExistente.rows[0].cardTemplateUrl;
          if (templateAntigo && templateAntigo.startsWith('https://storage.googleapis.com/')) {
            try {
              await deleteImage(templateAntigo);
            } catch (error) {
              console.error('Erro ao deletar template antigo:', error);
            }
          }
        }
        cardTemplateUrlProcessada = null;
      } else if (cardTemplateUrl.startsWith('data:image/')) {
        // Se for base64, fazer upload
        try {
          const buffer = base64ToBuffer(cardTemplateUrl);
          const mimeMatch = cardTemplateUrl.match(/data:image\/(\w+);base64,/);
          const extension = mimeMatch ? mimeMatch[1] : 'png';
          const fileName = `card-template-${id}-${Date.now()}.${extension}`;
          const result = await uploadImage(buffer, fileName, 'templates/cards');
          
          // Deletar template antigo se existir
          if (pointExistente.rows.length > 0 && pointExistente.rows[0].cardTemplateUrl) {
            const templateAntigo = pointExistente.rows[0].cardTemplateUrl;
            if (templateAntigo && templateAntigo.startsWith('https://storage.googleapis.com/')) {
              try {
                await deleteImage(templateAntigo);
              } catch (error) {
                console.error('Erro ao deletar template antigo:', error);
              }
            }
          }
          
          cardTemplateUrlProcessada = result.url;
        } catch (error) {
          console.error('Erro ao fazer upload do template de card:', error);
          const errorResponse = NextResponse.json(
            { mensagem: 'Erro ao fazer upload do template de card' },
            { status: 500 }
          );
          return withCors(errorResponse, request);
        }
      } else if (cardTemplateUrl.startsWith('http://') || cardTemplateUrl.startsWith('https://')) {
        // Se já for uma URL, manter como está
        cardTemplateUrlProcessada = cardTemplateUrl;
      } else {
        cardTemplateUrlProcessada = null;
      }
    }

    // Usar cardTemplateUrlProcessada se foi processado, senão usar cardTemplateUrl original ou manter o atual
    const cardTemplateUrlFinal = cardTemplateUrlProcessada !== undefined 
      ? cardTemplateUrlProcessada 
      : (cardTemplateUrl !== undefined ? cardTemplateUrl : (pointExistente.rows.length > 0 ? pointExistente.rows[0].cardTemplateUrl : null));

    // Para ORGANIZER, buscar valores atuais apenas para manter campos administrativos inalterados
    // Para ADMIN, usar valores do body
    let pointAtual: any = { rows: [] };
    if (isOrganizer) {
      // ORGANIZER: buscar apenas campos básicos para manter ativo inalterado
      try {
        pointAtual = await query(
          'SELECT ativo FROM "Point" WHERE id = $1',
          [id]
        );
      } catch (error: any) {
        console.error('Erro ao buscar point atual:', error);
      }
    }

    const ativoFinal = isOrganizer 
      ? (pointAtual.rows.length > 0 ? pointAtual.rows[0].ativo : true) 
      : (ativo ?? true);
    const whatsappAccessTokenFinal = isOrganizer ? null : (whatsappAccessToken || null);
    const whatsappPhoneNumberIdFinal = isOrganizer ? null : (whatsappPhoneNumberId || null);
    const whatsappBusinessAccountIdFinal = isOrganizer ? null : (whatsappBusinessAccountId || null);
    const whatsappApiVersionFinal = isOrganizer ? 'v21.0' : (whatsappApiVersion || 'v21.0');
    const whatsappAtivoFinal = isOrganizer ? false : (whatsappAtivo ?? false);
    const gzappyApiKeyFinal = isOrganizer ? null : (gzappyApiKey || null);
    const gzappyInstanceIdFinal = isOrganizer ? null : (gzappyInstanceId || null);
    const gzappyAtivoFinal = isOrganizer ? false : (gzappyAtivo ?? false);
    const infinitePayHandleFinal = isOrganizer ? null : (infinitePayHandle || null);
    const pagBankAtivoFinal = isOrganizer ? false : (pagBankAtivo ?? false);
    const pagBankEnvFinal = isOrganizer ? null : (pagBankEnv || null);
    const pagBankTokenFinal = isOrganizer ? null : (pagBankToken || null);
    const pagBankWebhookTokenFinal = isOrganizer ? null : (pagBankWebhookToken || null);

    // Tentar primeiro com campos WhatsApp e Gzappy (se existirem)
    let result;
    try {
      if (isOrganizer) {
        // ORGANIZER: atualizar apenas campos permitidos (sem credenciais administrativas)
        // Tentar primeiro com campos de lembrete
        try {
          result = await query(
            `UPDATE "Point"
             SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, "cardTemplateUrl" = $7, latitude = $8, longitude = $9,
                 "enviarLembretesAgendamento" = $10, "antecedenciaLembrete" = $11, "updatedAt" = NOW()
             WHERE id = $12
             RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
                       "enviarLembretesAgendamento", "antecedenciaLembrete",
                       "createdAt", "updatedAt"`,
            [
              nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
              cardTemplateUrlFinal, latitude || null, longitude || null,
              enviarLembretesAgendamento ?? false, antecedenciaLembrete || null,
              id
            ]
          );
        } catch (errorOrg: any) {
          // Se campos de lembrete não existem, atualizar sem eles
          if (errorOrg.message?.includes('enviarLembretesAgendamento') || errorOrg.message?.includes('antecedenciaLembrete') || errorOrg.code === '42703') {
            console.log('⚠️ Campos de lembrete não encontrados, atualizando sem eles');
            result = await query(
              `UPDATE "Point"
               SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, "cardTemplateUrl" = $7, latitude = $8, longitude = $9, "updatedAt" = NOW()
               WHERE id = $10
               RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
                         "createdAt", "updatedAt"`,
              [
                nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
                cardTemplateUrlFinal, latitude || null, longitude || null,
                id
              ]
            );
            // Adicionar campos de lembrete como false/null para compatibilidade
            if (result.rows.length > 0) {
              result.rows[0].enviarLembretesAgendamento = false;
              result.rows[0].antecedenciaLembrete = 8;
            }
          } else {
            throw errorOrg;
          }
        }
        // Adicionar campos administrativos como null/false para compatibilidade (ORGANIZER não pode ver/alterar)
        if (result.rows.length > 0) {
          result.rows[0] = {
            ...result.rows[0],
            whatsappAccessToken: null,
            whatsappPhoneNumberId: null,
            whatsappBusinessAccountId: null,
            whatsappApiVersion: 'v21.0',
            whatsappAtivo: false,
            gzappyApiKey: null,
            gzappyInstanceId: null,
            gzappyAtivo: false,
            infinitePayHandle: null,
            pagBankAtivo: false,
            pagBankEnv: null,
            pagBankToken: null,
            pagBankWebhookToken: null,
          };
        }
      } else {
        // ADMIN: atualizar todos os campos
        result = await query(
          `UPDATE "Point"
           SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, "cardTemplateUrl" = $7, latitude = $8, longitude = $9, ativo = $10,
               "whatsappAccessToken" = $11, "whatsappPhoneNumberId" = $12, "whatsappBusinessAccountId" = $13, 
               "whatsappApiVersion" = $14, "whatsappAtivo" = $15,
               "gzappyApiKey" = $16, "gzappyInstanceId" = $17, "gzappyAtivo" = $18,
               "enviarLembretesAgendamento" = $19, "antecedenciaLembrete" = $20, 
               "infinitePayHandle" = $21,
               "pagBankAtivo" = $22, "pagBankEnv" = $23, "pagBankToken" = $24, "pagBankWebhookToken" = $25,
               "updatedAt" = NOW()
           WHERE id = $26
           RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
                     "whatsappAccessToken", "whatsappPhoneNumberId", "whatsappBusinessAccountId", "whatsappApiVersion", "whatsappAtivo",
                     "gzappyApiKey", "gzappyInstanceId", "gzappyAtivo",
                     "enviarLembretesAgendamento", "antecedenciaLembrete",
                     "infinitePayHandle",
                     "pagBankAtivo", "pagBankEnv", "pagBankToken", "pagBankWebhookToken",
                     "createdAt", "updatedAt"`,
          [
            nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
            cardTemplateUrlFinal, latitude || null, longitude || null, ativoFinal,
            whatsappAccessTokenFinal, whatsappPhoneNumberIdFinal, whatsappBusinessAccountIdFinal,
            whatsappApiVersionFinal, whatsappAtivoFinal,
            gzappyApiKeyFinal, gzappyInstanceIdFinal, gzappyAtivoFinal,
            enviarLembretesAgendamento ?? false, antecedenciaLembrete || null,
            infinitePayHandleFinal,
            pagBankAtivoFinal,
            pagBankEnvFinal,
            pagBankTokenFinal,
            pagBankWebhookTokenFinal,
            id
          ]
        );
      }
    } catch (error: any) {
      // Se falhar (colunas WhatsApp/Gzappy não existem), tentar sem elas
      if (error.message?.includes('whatsapp') || error.message?.includes('gzappy') || error.message?.includes('column') || error.message?.includes('enviarLembretesAgendamento') || error.message?.includes('antecedenciaLembrete') || error.code === '42703') {
        console.log('⚠️ Alguns campos não encontrados, atualizando sem eles');
        try {
          // Tentar com campos de lembrete
          result = await query(
            `UPDATE "Point"
             SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, "cardTemplateUrl" = $7, latitude = $8, longitude = $9, ativo = $10, "updatedAt" = NOW()
             WHERE id = $11
             RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", "cardTemplateUrl", latitude, longitude, ativo,
                       "createdAt", "updatedAt"`,
            [
              nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
              cardTemplateUrlFinal, latitude || null, longitude || null, ativoFinal,
              id
            ]
          );
          // Adicionar campos faltantes como null/false para compatibilidade
          if (result.rows.length > 0) {
            result.rows[0] = {
              ...result.rows[0],
              whatsappAccessToken: null,
              whatsappPhoneNumberId: null,
              whatsappBusinessAccountId: null,
              whatsappApiVersion: 'v21.0',
              whatsappAtivo: false,
              gzappyApiKey: null,
              gzappyInstanceId: null,
              gzappyAtivo: false,
              enviarLembretesAgendamento: isOrganizer ? (enviarLembretesAgendamento ?? false) : false,
              antecedenciaLembrete: isOrganizer ? (antecedenciaLembrete || null) : 8,
              infinitePayHandle: null,
              pagBankAtivo: false,
              pagBankEnv: null,
              pagBankToken: null,
              pagBankWebhookToken: null,
            };
          }
        } catch (error2: any) {
          // Se ainda falhar, tentar sem campos opcionais
          if (error2.message?.includes('cardTemplateUrl') || error2.code === '42703') {
            result = await query(
              `UPDATE "Point"
               SET nome = $1, endereco = $2, telefone = $3, email = $4, descricao = $5, "logoUrl" = $6, latitude = $7, longitude = $8, ativo = $9, "updatedAt" = NOW()
               WHERE id = $10
               RETURNING id, nome, endereco, telefone, email, descricao, "logoUrl", latitude, longitude, ativo,
                         "createdAt", "updatedAt"`,
              [
                nome, endereco || null, telefone || null, email || null, descricao || null, logoUrlFinal, 
                latitude || null, longitude || null, ativoFinal,
                id
              ]
            );
            // Adicionar campos faltantes como null/false para compatibilidade
            if (result.rows.length > 0) {
              result.rows[0] = {
                ...result.rows[0],
                cardTemplateUrl: null,
                whatsappAccessToken: null,
                whatsappPhoneNumberId: null,
                whatsappBusinessAccountId: null,
                whatsappApiVersion: 'v21.0',
                whatsappAtivo: false,
                gzappyApiKey: null,
                gzappyInstanceId: null,
                gzappyAtivo: false,
                enviarLembretesAgendamento: isOrganizer ? (enviarLembretesAgendamento ?? false) : false,
                antecedenciaLembrete: isOrganizer ? (antecedenciaLembrete || null) : 8,
                infinitePayHandle: null,
                pagBankAtivo: false,
                pagBankEnv: null,
                pagBankToken: null,
                pagBankWebhookToken: null,
              };
            }
          } else {
            throw error2;
          }
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    if (typeof pagamentoOnlineAtivo === 'boolean') {
      try {
        const r = await query(
          `UPDATE "Point"
           SET "pagamentoOnlineAtivo" = $1, "updatedAt" = NOW()
           WHERE id = $2
           RETURNING "pagamentoOnlineAtivo"`,
          [pagamentoOnlineAtivo, id]
        );
        if (r.rows.length > 0) {
          result.rows[0].pagamentoOnlineAtivo = r.rows[0].pagamentoOnlineAtivo === true;
        }
      } catch (e: any) {
        if (e?.code !== '42703') {
          throw e;
        }
      }
    }

    if (pixChave !== undefined) {
      const value = pixChave ? String(pixChave).trim() : null;
      try {
        const r = await query(
          `UPDATE "Point"
           SET "pixChave" = $1, "updatedAt" = NOW()
           WHERE id = $2
           RETURNING "pixChave"`,
          [value, id]
        );
        if (r.rows.length > 0) {
          result.rows[0].pixChave = r.rows[0].pixChave ?? null;
        }
      } catch (e: any) {
        if (e?.code !== '42703') {
          throw e;
        }
      }
    }

    const response = NextResponse.json(result.rows[0]);
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao atualizar point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao atualizar estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// DELETE /api/point/[id] - Deletar point
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verificar se há quadras vinculadas
    const quadrasResult = await query(
      `SELECT COUNT(*) as count FROM "Quadra" WHERE "pointId" = $1`,
      [id]
    );

    if (parseInt(quadrasResult.rows[0].count) > 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Não é possível deletar estabelecimento com quadras vinculadas' },
        { status: 400 }
      );
      return withCors(errorResponse, request);
    }

    const result = await query(
      `DELETE FROM "Point" WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      const errorResponse = NextResponse.json(
        { mensagem: 'Estabelecimento não encontrado' },
        { status: 404 }
      );
      return withCors(errorResponse, request);
    }

    const response = NextResponse.json({ mensagem: 'Estabelecimento deletado com sucesso' });
    return withCors(response, request);
  } catch (error: any) {
    console.error('Erro ao deletar point:', error);
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao deletar estabelecimento', error: error.message },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}

// Suportar requisições OPTIONS (preflight)
export async function OPTIONS(request: NextRequest) {
  console.log('[CORS] OPTIONS request recebida para /api/point/[id]');
  const origin = request.headers.get('origin');
  console.log('[CORS] Origin:', origin);
  const response = withCors(new NextResponse(null, { status: 204 }), request);
  console.log('[CORS] Headers retornados:', Object.fromEntries(response.headers.entries()));
  return response;
}
