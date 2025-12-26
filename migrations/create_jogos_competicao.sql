-- Migração: Adicionar tabela de jogos da competição
-- Extensão do módulo de competições para gerenciar jogos/partidas

-- Tabela de Jogos da Competição
CREATE TABLE IF NOT EXISTS "JogoCompeticao" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "competicaoId" TEXT NOT NULL,
  "rodada" TEXT NOT NULL CHECK (rodada IN ('QUARTAS_FINAL', 'SEMIFINAL', 'FINAL')),
  "numeroJogo" INTEGER NOT NULL, -- Número do jogo dentro da rodada (1, 2, 3, 4 para quartas, etc)
  "atleta1Id" TEXT, -- Para individual: ID do atleta, Para duplas: ID da parceria (parceriaId)
  "atleta2Id" TEXT, -- Para individual: ID do atleta, Para duplas: ID da parceria (parceriaId)
  "atleta1ParceriaId" TEXT, -- Se for duplas, referencia parceriaId
  "atleta2ParceriaId" TEXT, -- Se for duplas, referencia parceriaId
  "vencedorId" TEXT, -- ID do vencedor (atletaId ou parceriaId)
  "pontosAtleta1" INTEGER DEFAULT 0,
  "pontosAtleta2" INTEGER DEFAULT 0,
  "gamesAtleta1" INTEGER,
  "gamesAtleta2" INTEGER,
  "tiebreakAtleta1" INTEGER,
  "tiebreakAtleta2" INTEGER,
  "dataHora" TIMESTAMP WITH TIME ZONE,
  "quadraId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AGENDADO' CHECK (status IN ('AGENDADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO')),
  "observacoes" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_jogo_competicao_competicao FOREIGN KEY ("competicaoId") REFERENCES "Competicao"(id) ON DELETE CASCADE,
  CONSTRAINT fk_jogo_competicao_quadra FOREIGN KEY ("quadraId") REFERENCES "Quadra"(id) ON DELETE SET NULL,
  -- Garantir que não há jogos duplicados na mesma rodada
  CONSTRAINT uk_jogo_competicao_rodada_numero UNIQUE ("competicaoId", "rodada", "numeroJogo")
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_competicao_id ON "JogoCompeticao"("competicaoId");
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_rodada ON "JogoCompeticao"("competicaoId", "rodada");
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_atleta1 ON "JogoCompeticao"("atleta1Id") WHERE "atleta1Id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_atleta2 ON "JogoCompeticao"("atleta2Id") WHERE "atleta2Id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jogo_competicao_status ON "JogoCompeticao"("status");

-- Trigger para atualizar updatedAt automaticamente
CREATE TRIGGER trigger_update_jogo_competicao_updated_at
BEFORE UPDATE ON "JogoCompeticao"
FOR EACH ROW
EXECUTE FUNCTION update_competicao_updated_at();

