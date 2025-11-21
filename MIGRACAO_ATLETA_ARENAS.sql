-- Migração: Adicionar relacionamento entre Atleta e Point (arenas que frequenta)
-- Execute este script no seu banco de dados PostgreSQL

-- Adicionar campo para arena principal (mais próxima da casa)
ALTER TABLE "Atleta" 
ADD COLUMN IF NOT EXISTS "pointIdPrincipal" TEXT;

-- Criar tabela de relacionamento muitos-para-muitos entre Atleta e Point
CREATE TABLE IF NOT EXISTS "AtletaPoint" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "atletaId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "fk_atleta" FOREIGN KEY ("atletaId") REFERENCES "Atleta"(id) ON DELETE CASCADE,
  CONSTRAINT "fk_point" FOREIGN KEY ("pointId") REFERENCES "Point"(id) ON DELETE CASCADE,
  CONSTRAINT "uk_atleta_point" UNIQUE ("atletaId", "pointId")
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS "idx_atleta_point_atleta" ON "AtletaPoint"("atletaId");
CREATE INDEX IF NOT EXISTS "idx_atleta_point_point" ON "AtletaPoint"("pointId");
CREATE INDEX IF NOT EXISTS "idx_atleta_point_principal" ON "Atleta"("pointIdPrincipal");

-- Verificar se as colunas e tabela foram criadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Atleta' 
AND column_name = 'pointIdPrincipal';

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'AtletaPoint';

