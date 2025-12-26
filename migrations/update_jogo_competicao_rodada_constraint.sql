-- Migração: Atualizar constraint de rodada para incluir RODADA_1 a RODADA_7
-- Necessário para suportar formato round-robin de duplas

-- Remover a constraint antiga
ALTER TABLE "JogoCompeticao" 
DROP CONSTRAINT IF EXISTS "JogoCompeticao_rodada_check";

-- Adicionar nova constraint com todas as rodadas possíveis
ALTER TABLE "JogoCompeticao"
ADD CONSTRAINT "JogoCompeticao_rodada_check" 
CHECK (rodada IN (
  'RODADA_1', 'RODADA_2', 'RODADA_3', 'RODADA_4', 'RODADA_5', 'RODADA_6', 'RODADA_7',
  'QUARTAS_FINAL', 'SEMIFINAL', 'FINAL'
));

