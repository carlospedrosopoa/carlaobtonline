-- Migration: Criar tabela PartidaPanelinha
-- Data: 2024-12-20
-- Descrição: Vincula partidas às panelinhas, permitindo que jogos apareçam em "Meus Jogos" e na panelinha

CREATE TABLE IF NOT EXISTS "PartidaPanelinha" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "partidaId" TEXT NOT NULL,
  "panelinhaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_partida_panelinha_partida 
    FOREIGN KEY ("partidaId") 
    REFERENCES "Partida"(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_partida_panelinha_panelinha 
    FOREIGN KEY ("panelinhaId") 
    REFERENCES "Panelinha"(id) 
    ON DELETE CASCADE,
    
  -- Garantir que uma partida não pode estar duplicada na mesma panelinha
  CONSTRAINT uk_partida_panelinha_unique 
    UNIQUE ("partidaId", "panelinhaId")
);

-- Comentários para documentação
COMMENT ON TABLE "PartidaPanelinha" IS 'Vincula partidas às panelinhas, permitindo que jogos apareçam tanto na panelinha quanto em "Meus Jogos"';
COMMENT ON COLUMN "PartidaPanelinha"."partidaId" IS 'ID da partida';
COMMENT ON COLUMN "PartidaPanelinha"."panelinhaId" IS 'ID da panelinha';

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_partida_panelinha_partida 
  ON "PartidaPanelinha"("partidaId");

CREATE INDEX IF NOT EXISTS idx_partida_panelinha_panelinha 
  ON "PartidaPanelinha"("panelinhaId");


