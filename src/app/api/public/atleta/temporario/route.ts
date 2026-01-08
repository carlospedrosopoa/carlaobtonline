// app/api/public/atleta/temporario/route.ts
// API pública para criar atleta temporário (sem cadastro completo)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { withCors, handleCorsPreflight } from '@/lib/cors';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflight(request);
  return preflightResponse || new NextResponse(null, { status: 204 });
}

// POST /api/public/atleta/temporario
// Cria um atleta temporário com apenas nome e telefone
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, telefone, pointId, usuarioId } = body;

    if (!nome || !nome.trim()) {
      return withCors(
        NextResponse.json({ mensagem: 'Nome é obrigatório' }, { status: 400 }),
        request
      );
    }

    if (!telefone || !telefone.trim()) {
      return withCors(
        NextResponse.json({ mensagem: 'Telefone é obrigatório' }, { status: 400 }),
        request
      );
    }

    if (!pointId) {
      return withCors(
        NextResponse.json({ mensagem: 'pointId é obrigatório' }, { status: 400 }),
        request
      );
    }

    // Verificar se o point existe
    const pointResult = await query('SELECT id FROM "Point" WHERE id = $1', [pointId]);
    if (pointResult.rows.length === 0) {
      return withCors(
        NextResponse.json({ mensagem: 'Arena não encontrada' }, { status: 404 }),
        request
      );
    }

    // Normalizar telefone (remover formatação)
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Verificar se já existe um atleta com este telefone
    const atletaExistenteResult = await query(
      `SELECT id, nome, fone, "usuarioId" 
       FROM "Atleta" 
       WHERE fone = $1 
       ORDER BY "createdAt" DESC 
       LIMIT 1`,
      [telefoneNormalizado]
    );

    if (atletaExistenteResult.rows.length > 0) {
      // Atleta já existe
      const atletaExistente = atletaExistenteResult.rows[0];
      
      // Se o atleta não tem usuarioId, criar usuário temporário e vincular
      if (!atletaExistente.usuarioId) {
        // Determinar usuarioIdFinal: usar o informado se válido, senão criar usuário temporário
        let usuarioIdFinal: string | null = null;
        
        if (usuarioId) {
          // Validar se o usuarioId existe no banco
          const userCheck = await query('SELECT id FROM "User" WHERE id = $1', [usuarioId]);
          if (userCheck.rows.length > 0) {
            usuarioIdFinal = usuarioId;
          }
        }
        
        // Se não tem usuarioId válido, criar usuário temporário com email temporário
        if (!usuarioIdFinal) {
          const usuarioTemporarioId = uuidv4();
          const emailTemporario = `temp_${usuarioTemporarioId}@pendente.local`;
          
          // Gerar senha temporária (hash de string aleatória)
          const senhaTemporariaAleatoria = `temp_${usuarioTemporarioId}_${Date.now()}_${Math.random().toString(36)}`;
          const senhaTemporaria = await bcrypt.hash(senhaTemporariaAleatoria, 12);
          
          console.log(`[ATLETA TEMPORÁRIO] Criando usuário temporário para atleta existente: ${emailTemporario}`);
          
          // Criar usuário temporário
          try {
            await query(
              'INSERT INTO "User" (id, name, email, password, role, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
              [usuarioTemporarioId, nome.trim(), emailTemporario, senhaTemporaria, 'USER']
            );
            console.log(`[ATLETA TEMPORÁRIO] Usuário temporário criado com sucesso: ${usuarioTemporarioId}`);
            usuarioIdFinal = usuarioTemporarioId;
          } catch (error: any) {
            console.error(`[ATLETA TEMPORÁRIO] Erro ao criar usuário temporário:`, error);
            throw new Error(`Erro ao criar usuário temporário: ${error.message}`);
          }
        }
        
        // Validar que temos usuarioIdFinal antes de vincular
        if (!usuarioIdFinal) {
          console.error('[ATLETA TEMPORÁRIO] ERRO CRÍTICO: usuarioIdFinal é null antes de vincular atleta existente');
          throw new Error('Erro interno: não foi possível criar usuário temporário');
        }
        
        console.log(`[ATLETA TEMPORÁRIO] Vinculando atleta existente ${atletaExistente.id} ao usuário ${usuarioIdFinal}`);
        
        // Vincular o atleta existente ao usuário criado
        try {
          await query(
            `UPDATE "Atleta" 
             SET "usuarioId" = $1, nome = $2, "updatedAt" = NOW() 
             WHERE id = $3`,
            [usuarioIdFinal, nome.trim(), atletaExistente.id]
          );
          console.log(`[ATLETA TEMPORÁRIO] Atleta existente vinculado com sucesso ao usuário ${usuarioIdFinal}`);
        } catch (error: any) {
          console.error(`[ATLETA TEMPORÁRIO] Erro ao vincular atleta existente:`, error);
          throw new Error(`Erro ao vincular atleta existente: ${error.message}`);
        }
        
        return withCors(
          NextResponse.json({
            id: atletaExistente.id,
            nome: nome.trim(),
            telefone: telefoneNormalizado,
            temporario: true,
            existente: true,
            usuarioIdCriado: usuarioIdFinal,
          }),
          request
        );
      }
      
      // Se o atleta já tem usuarioId, apenas atualizar nome se necessário
      if (atletaExistente.nome !== nome.trim()) {
        await query(
          `UPDATE "Atleta" 
           SET nome = $1, "updatedAt" = NOW() 
           WHERE id = $2`,
          [nome.trim(), atletaExistente.id]
        );
      }

      return withCors(
        NextResponse.json({
          id: atletaExistente.id,
          nome: nome.trim(),
          telefone: telefoneNormalizado,
          temporario: false, // Não é temporário se já tem usuarioId
          existente: true,
        }),
        request
      );
    }

    // Se não existe, criar novo atleta temporário
    // A tabela Atleta requer usuarioId NOT NULL, então SEMPRE precisamos criar um usuário temporário
    const atletaId = uuidv4();
    const dataNascimentoPadrao = new Date('2000-01-01'); // Data padrão para atletas temporários
    
    // Determinar usuarioIdFinal: usar o informado se válido, senão criar usuário temporário
    let usuarioIdFinal: string | null = null;
    
    if (usuarioId) {
      // Validar se o usuarioId existe no banco
      const userCheck = await query('SELECT id FROM "User" WHERE id = $1', [usuarioId]);
      if (userCheck.rows.length > 0) {
        // UsuarioId existe e é válido, usar ele
        usuarioIdFinal = usuarioId;
        console.log(`[ATLETA TEMPORÁRIO] Usando usuarioId existente: ${usuarioId}`);
      } else {
        // Se usuarioId não existe, criar usuário temporário
        console.warn(`[ATLETA TEMPORÁRIO] usuarioId ${usuarioId} informado não existe, criando usuário temporário`);
      }
    }
    
    // Se não tem usuarioId válido, SEMPRE criar usuário temporário com email temporário
    if (!usuarioIdFinal) {
      const usuarioTemporarioId = uuidv4();
      const emailTemporario = `temp_${usuarioTemporarioId}@pendente.local`;
      
      // Gerar senha temporária (hash de string aleatória)
      const senhaTemporariaAleatoria = `temp_${usuarioTemporarioId}_${Date.now()}_${Math.random().toString(36)}`;
      const senhaTemporaria = await bcrypt.hash(senhaTemporariaAleatoria, 12);
      
      console.log(`[ATLETA TEMPORÁRIO] Criando usuário temporário: ${emailTemporario}`);
      
      // Criar usuário temporário
      try {
        await query(
          'INSERT INTO "User" (id, name, email, password, role, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())',
          [usuarioTemporarioId, nome.trim(), emailTemporario, senhaTemporaria, 'USER']
        );
        console.log(`[ATLETA TEMPORÁRIO] Usuário temporário criado com sucesso: ${usuarioTemporarioId}`);
        usuarioIdFinal = usuarioTemporarioId;
      } catch (error: any) {
        console.error(`[ATLETA TEMPORÁRIO] Erro ao criar usuário temporário:`, error);
        throw new Error(`Erro ao criar usuário temporário: ${error.message}`);
      }
    }
    
    // Validar que temos usuarioIdFinal antes de criar o atleta
    if (!usuarioIdFinal) {
      console.error('[ATLETA TEMPORÁRIO] ERRO CRÍTICO: usuarioIdFinal é null antes de criar atleta');
      throw new Error('Erro interno: não foi possível criar usuário temporário');
    }
    
    console.log(`[ATLETA TEMPORÁRIO] Criando atleta com usuarioId: ${usuarioIdFinal}`);
    
    // Agora temos usuarioIdFinal válido, podemos criar o atleta
    try {
      await query(
        `INSERT INTO "Atleta" (id, nome, fone, "dataNascimento", "usuarioId", "pointIdPrincipal", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [atletaId, nome.trim(), telefoneNormalizado, dataNascimentoPadrao, usuarioIdFinal, pointId]
      );
      console.log(`[ATLETA TEMPORÁRIO] Atleta criado com sucesso: ${atletaId} vinculado ao usuário ${usuarioIdFinal}`);
    } catch (error: any) {
      console.error(`[ATLETA TEMPORÁRIO] Erro ao criar atleta:`, error);
      throw new Error(`Erro ao criar atleta: ${error.message}`);
    }

    return withCors(
      NextResponse.json({
        id: atletaId,
        nome: nome.trim(),
        telefone: telefoneNormalizado,
        temporario: true,
        existente: false,
      }),
      request
    );
  } catch (error: any) {
    console.error('Erro ao criar atleta temporário:', error);
    return withCors(
      NextResponse.json(
        { mensagem: 'Erro ao criar atleta temporário', erro: error.message },
        { status: 500 }
      ),
      request
    );
  }
}

