-- Migração: Atualizar constraint da coluna "tipo" na tabela "Competicao"
-- Para incluir os novos tipos: SUPER_8, SUPER_12, REI_DA_QUADRA

BEGIN;

-- 1. Remover a constraint antiga
ALTER TABLE "Competicao" DROP CONSTRAINT IF EXISTS "Competicao_tipo_check";

-- 2. Adicionar a nova constraint com os valores permitidos atualizados
ALTER TABLE "Competicao" ADD CONSTRAINT "Competicao_tipo_check" CHECK (tipo IN (
  'SUPER_8',
  'SUPER_12',
  'REI_DA_QUADRA'
));

COMMIT;

