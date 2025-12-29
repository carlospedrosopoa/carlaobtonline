-- Adicionar campos de imagem na tabela Competicao
-- cardDivulgacaoUrl: URL da imagem do card de divulgação
-- fotoCompeticaoUrl: URL da foto da competição

ALTER TABLE "Competicao" 
ADD COLUMN IF NOT EXISTS "cardDivulgacaoUrl" TEXT NULL,
ADD COLUMN IF NOT EXISTS "fotoCompeticaoUrl" TEXT NULL;

