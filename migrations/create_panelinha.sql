-- Migration: Criar tabelas para sistema de Panelinhas
-- Data: 2024-12-19
-- Descrição: Permite que atletas criem e gerenciem suas "panelinhas" (grupos de jogos)

-- Tabela Panelinha: grupos de atletas criados por um atleta
CREATE TABLE IF NOT EXISTS "Panelinha" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  "atletaIdCriador" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_panelinha_atleta_criador 
    FOREIGN KEY ("atletaIdCriador") 
    REFERENCES "Atleta"(id) 
    ON DELETE CASCADE
);

-- Comentários para documentação
COMMENT ON TABLE "Panelinha" IS 'Grupos de atletas criados por um atleta para organizar suas turmas de jogos';
COMMENT ON COLUMN "Panelinha"."atletaIdCriador" IS 'ID do atleta que criou a panelinha';

-- Tabela PanelinhaAtleta: relacionamento muitos-para-muitos entre Panelinha e Atleta
CREATE TABLE IF NOT EXISTS "PanelinhaAtleta" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "panelinhaId" TEXT NOT NULL,
  "atletaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_panelinha_atleta_panelinha 
    FOREIGN KEY ("panelinhaId") 
    REFERENCES "Panelinha"(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_panelinha_atleta_atleta 
    FOREIGN KEY ("atletaId") 
    REFERENCES "Atleta"(id) 
    ON DELETE CASCADE,
    
  -- Garantir que um atleta não pode estar duplicado na mesma panelinha
  CONSTRAINT uk_panelinha_atleta_unique 
    UNIQUE ("panelinhaId", "atletaId")
);

-- Comentários para documentação
COMMENT ON TABLE "PanelinhaAtleta" IS 'Relacionamento entre panelinhas e atletas (muitos-para-muitos)';
COMMENT ON COLUMN "PanelinhaAtleta"."panelinhaId" IS 'ID da panelinha';
COMMENT ON COLUMN "PanelinhaAtleta"."atletaId" IS 'ID do atleta membro da panelinha';

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_panelinha_atleta_criador 
  ON "Panelinha"("atletaIdCriador");

CREATE INDEX IF NOT EXISTS idx_panelinha_atleta_panelinha 
  ON "PanelinhaAtleta"("panelinhaId");

CREATE INDEX IF NOT EXISTS idx_panelinha_atleta_atleta 
  ON "PanelinhaAtleta"("atletaId");

