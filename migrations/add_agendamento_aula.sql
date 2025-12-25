-- Migration: Adicionar suporte a agendamentos de aula na tabela Agendamento
-- Data: 2024-01-XX
-- Descrição: Adiciona campos para identificar agendamentos de aula e vincular a professores

-- Adicionar campo ehAula (boolean) para identificar se o agendamento é para aula
ALTER TABLE "Agendamento" 
ADD COLUMN IF NOT EXISTS "ehAula" BOOLEAN DEFAULT false;

-- Adicionar campo professorId (opcional) para vincular o agendamento a um professor
ALTER TABLE "Agendamento" 
ADD COLUMN IF NOT EXISTS "professorId" TEXT DEFAULT NULL;

-- Adicionar chave estrangeira para Professor (se a tabela existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Professor') THEN
        -- Remover constraint se já existir (para evitar erro em reexecução)
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_agendamento_professor'
        ) THEN
            ALTER TABLE "Agendamento" DROP CONSTRAINT fk_agendamento_professor;
        END IF;
        
        -- Adicionar constraint de chave estrangeira
        ALTER TABLE "Agendamento"
        ADD CONSTRAINT fk_agendamento_professor
        FOREIGN KEY ("professorId") 
        REFERENCES "Professor"(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Criar índice para otimizar buscas por professor
CREATE INDEX IF NOT EXISTS idx_agendamento_professor_id ON "Agendamento"("professorId");

-- Criar índice para otimizar buscas por tipo de agendamento (aula vs normal)
CREATE INDEX IF NOT EXISTS idx_agendamento_eh_aula ON "Agendamento"("ehAula");

-- Comentários
COMMENT ON COLUMN "Agendamento"."ehAula" IS 'Indica se o agendamento é para uma aula/professor (true) ou locação normal (false)';
COMMENT ON COLUMN "Agendamento"."professorId" IS 'ID do professor vinculado ao agendamento (apenas quando ehAula = true)';

