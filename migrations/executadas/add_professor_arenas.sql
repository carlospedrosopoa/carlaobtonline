-- Migration: Adicionar suporte a arenas para professores (similar ao que existe para atletas)
-- Data: 2024-01-XX
-- Descrição: Adiciona campo pointIdPrincipal e tabela ProfessorPoint para relacionar professores com arenas

-- Adicionar campo pointIdPrincipal na tabela Professor
ALTER TABLE "Professor" 
ADD COLUMN IF NOT EXISTS "pointIdPrincipal" TEXT DEFAULT NULL;

-- Adicionar chave estrangeira para Point (arena principal)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Point') THEN
        -- Remover constraint se já existir (para evitar erro em reexecução)
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_professor_point_principal'
        ) THEN
            ALTER TABLE "Professor" DROP CONSTRAINT fk_professor_point_principal;
        END IF;
        
        -- Adicionar constraint de chave estrangeira
        ALTER TABLE "Professor"
        ADD CONSTRAINT fk_professor_point_principal
        FOREIGN KEY ("pointIdPrincipal") 
        REFERENCES "Point"(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Criar tabela ProfessorPoint para arenas frequentes (múltiplas)
CREATE TABLE IF NOT EXISTS "ProfessorPoint" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "professorId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_professor_point_professor FOREIGN KEY ("professorId") REFERENCES "Professor"(id) ON DELETE CASCADE,
    CONSTRAINT fk_professor_point_point FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE CASCADE,
    CONSTRAINT uk_professor_point_unique UNIQUE ("professorId", "pointId")
);

-- Criar índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_professor_point_id ON "Professor"("pointIdPrincipal");
CREATE INDEX IF NOT EXISTS idx_professor_point_professor_id ON "ProfessorPoint"("professorId");
CREATE INDEX IF NOT EXISTS idx_professor_point_point_id ON "ProfessorPoint"("pointId");

-- Comentários
COMMENT ON COLUMN "Professor"."pointIdPrincipal" IS 'ID da arena principal onde o professor atua';
COMMENT ON TABLE "ProfessorPoint" IS 'Relação muitos-para-muitos entre professor e arenas (arenas frequentes)';
COMMENT ON COLUMN "ProfessorPoint"."professorId" IS 'ID do professor';
COMMENT ON COLUMN "ProfessorPoint"."pointId" IS 'ID da arena';


