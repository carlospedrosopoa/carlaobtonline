-- Migração: Adicionar coluna updatedAt na tabela AtletaCompeticao
-- Necessário para rastrear quando os registros são atualizados

-- Adicionar coluna updatedAt
ALTER TABLE "AtletaCompeticao" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Atualizar registros existentes para ter updatedAt igual a createdAt
UPDATE "AtletaCompeticao" 
SET "updatedAt" = "createdAt" 
WHERE "updatedAt" IS NULL OR "updatedAt" < "createdAt";

-- Criar trigger para atualizar updatedAt automaticamente
CREATE TRIGGER trigger_update_atleta_competicao_updated_at
BEFORE UPDATE ON "AtletaCompeticao"
FOR EACH ROW
EXECUTE FUNCTION update_competicao_updated_at();

