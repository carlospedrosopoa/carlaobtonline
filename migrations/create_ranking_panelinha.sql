-- Migration: Criar tabela RankingPanelinha
-- Data: 2024-12-20
-- Descrição: Armazena o ranking de cada atleta em cada panelinha

CREATE TABLE IF NOT EXISTS "RankingPanelinha" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "panelinhaId" TEXT NOT NULL,
  "atletaId" TEXT NOT NULL,
  "pontuacao" INTEGER DEFAULT 0,
  "vitorias" INTEGER DEFAULT 0,
  "derrotas" INTEGER DEFAULT 0,
  "derrotasTieBreak" INTEGER DEFAULT 0,
  "partidasJogadas" INTEGER DEFAULT 0,
  "saldoGames" INTEGER DEFAULT 0,
  "gamesFeitos" INTEGER DEFAULT 0,
  "gamesSofridos" INTEGER DEFAULT 0,
  "posicao" INTEGER,
  "ultimaAtualizacao" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_ranking_panelinha_panelinha 
    FOREIGN KEY ("panelinhaId") 
    REFERENCES "Panelinha"(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_ranking_panelinha_atleta 
    FOREIGN KEY ("atletaId") 
    REFERENCES "Atleta"(id) 
    ON DELETE CASCADE,
    
  -- Garantir que um atleta não pode ter ranking duplicado na mesma panelinha
  CONSTRAINT uk_ranking_panelinha_unique 
    UNIQUE ("panelinhaId", "atletaId")
);

-- Comentários para documentação
COMMENT ON TABLE "RankingPanelinha" IS 'Ranking de cada atleta em cada panelinha';
COMMENT ON COLUMN "RankingPanelinha"."pontuacao" IS 'Total de pontos (vitórias = 3, derrotas no tie break = 1, derrotas normais = 0)';
COMMENT ON COLUMN "RankingPanelinha"."derrotasTieBreak" IS 'Número de derrotas que foram no tie break';
COMMENT ON COLUMN "RankingPanelinha"."saldoGames" IS 'Games feitos - games sofridos (tie break não conta)';
COMMENT ON COLUMN "RankingPanelinha"."gamesFeitos" IS 'Total de games marcados (apenas gamesTime1 + gamesTime2, sem tie break)';
COMMENT ON COLUMN "RankingPanelinha"."gamesSofridos" IS 'Total de games recebidos (apenas gamesTime1 + gamesTime2, sem tie break)';
COMMENT ON COLUMN "RankingPanelinha"."posicao" IS 'Posição atual no ranking (calculada)';

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_ranking_panelinha_panelinha 
  ON "RankingPanelinha"("panelinhaId");

CREATE INDEX IF NOT EXISTS idx_ranking_panelinha_atleta 
  ON "RankingPanelinha"("atletaId");

CREATE INDEX IF NOT EXISTS idx_ranking_panelinha_posicao 
  ON "RankingPanelinha"("panelinhaId", "posicao");

