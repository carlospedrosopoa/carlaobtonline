-- Migration: Adicionar suporte a colaboradores na tabela User
-- Data: 2024-12-31
-- Descrição: Adiciona campos para diferenciar colaboradores de gestores e rastrear gestor responsável

-- Adicionar campo ehColaborador (boolean) para identificar colaboradores
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ehColaborador" BOOLEAN DEFAULT false;

-- Adicionar campo gestorId (referência ao User que criou/gerencia este colaborador)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gestorId" TEXT REFERENCES "User"(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_user_eh_colaborador ON "User"("ehColaborador") WHERE "ehColaborador" = true;
CREATE INDEX IF NOT EXISTS idx_user_gestor_id ON "User"("gestorId");

-- Comentários nas colunas
COMMENT ON COLUMN "User"."ehColaborador" IS 'Indica se o usuário é um colaborador (true) ou gestor (false). Apenas para usuários com role ORGANIZER.';
COMMENT ON COLUMN "User"."gestorId" IS 'ID do usuário gestor que criou/gerencia este colaborador. NULL para gestores ou usuários sem gestor.';

