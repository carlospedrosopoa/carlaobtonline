-- Migração: Módulo de Competições
-- Criação das tabelas para gerenciar competições (Super 8, etc.)

-- Tabela principal de Competições
CREATE TABLE IF NOT EXISTS "Competicao" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pointId" TEXT NOT NULL,
  "quadraId" TEXT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('SUPER_8')),
  formato TEXT NOT NULL CHECK (formato IN ('DUPLAS', 'INDIVIDUAL')),
  status TEXT NOT NULL DEFAULT 'CRIADA' CHECK (status IN ('CRIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  "dataInicio" TIMESTAMP WITH TIME ZONE,
  "dataFim" TIMESTAMP WITH TIME ZONE,
  descricao TEXT,
  "valorInscricao" DECIMAL(10,2),
  premio TEXT,
  regras TEXT,
  "configSuper8" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_competicao_point FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE CASCADE,
  CONSTRAINT fk_competicao_quadra FOREIGN KEY ("quadraId") REFERENCES "Quadra"(id) ON DELETE SET NULL
);

-- Tabela de participantes da competição (atletas)
CREATE TABLE IF NOT EXISTS "AtletaCompeticao" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "competicaoId" TEXT NOT NULL,
  "atletaId" TEXT NOT NULL,
  -- Para formato DUPLAS: identificar duplas formadas
  "parceriaId" TEXT,
  "parceiroAtletaId" TEXT,
  -- Resultados
  "posicaoFinal" INTEGER,
  pontos DECIMAL(10,2) DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_atleta_competicao_competicao FOREIGN KEY ("competicaoId") REFERENCES "Competicao"(id) ON DELETE CASCADE,
  CONSTRAINT fk_atleta_competicao_atleta FOREIGN KEY ("atletaId") REFERENCES "Atleta"(id) ON DELETE CASCADE,
  CONSTRAINT fk_atleta_competicao_parceiro FOREIGN KEY ("parceiroAtletaId") REFERENCES "Atleta"(id) ON DELETE SET NULL,
  -- Garantir que um atleta só participe uma vez da mesma competição
  CONSTRAINT uk_atleta_competicao UNIQUE ("competicaoId", "atletaId")
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_competicao_point_id ON "Competicao"("pointId");
CREATE INDEX IF NOT EXISTS idx_competicao_status ON "Competicao"(status);
CREATE INDEX IF NOT EXISTS idx_competicao_tipo ON "Competicao"(tipo);
CREATE INDEX IF NOT EXISTS idx_atleta_competicao_competicao_id ON "AtletaCompeticao"("competicaoId");
CREATE INDEX IF NOT EXISTS idx_atleta_competicao_atleta_id ON "AtletaCompeticao"("atletaId");
CREATE INDEX IF NOT EXISTS idx_atleta_competicao_parceria_id ON "AtletaCompeticao"("parceriaId") WHERE "parceriaId" IS NOT NULL;

-- Trigger para atualizar updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_competicao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_competicao_updated_at
BEFORE UPDATE ON "Competicao"
FOR EACH ROW
EXECUTE FUNCTION update_competicao_updated_at();


