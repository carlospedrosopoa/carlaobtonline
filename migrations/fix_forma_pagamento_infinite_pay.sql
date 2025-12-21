-- Migration: Corrigir tipo de forma de pagamento Infinite Pay
-- Data: 2025-12-21
-- Problema: Formas de pagamento Infinite Pay foram criadas com tipo 'CARTAO' que não é permitido
-- Solução: Atualizar para 'OUTRO' que é um tipo válido

-- Atualizar todas as formas de pagamento Infinite Pay para usar tipo 'OUTRO'
UPDATE "FormaPagamento"
SET tipo = 'OUTRO',
    "updatedAt" = NOW()
WHERE nome ILIKE '%infinite pay%'
  AND tipo = 'CARTAO';

-- Verificar se há outras formas de pagamento Infinite Pay com tipos inválidos
-- Se houver, atualizar para 'OUTRO'
UPDATE "FormaPagamento"
SET tipo = 'OUTRO',
    "updatedAt" = NOW()
WHERE nome ILIKE '%infinite pay%'
  AND tipo NOT IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'OUTRO');

-- Comentário: Esta migration corrige formas de pagamento Infinite Pay que foram criadas
-- com tipo inválido antes da correção do código

