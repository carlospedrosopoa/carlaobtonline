-- ============================================
-- MIGRAÇÃO: Suporte a Usuários Incompletos (Vínculo por Telefone)
-- ============================================
-- Este script prepara o banco de dados para suportar o fluxo de cadastro incompleto
-- onde Admin/Organizer cria usuários pendentes que serão vinculados posteriormente
-- pelos próprios usuários através do telefone no appatleta.
--
-- Data: 2024
-- ============================================

-- ============================================
-- 1. VERIFICAR E AJUSTAR ESTRUTURA DA TABELA USER
-- ============================================
-- Nota: A coluna email na tabela User provavelmente é NOT NULL.
-- Para usuários incompletos, usamos um email temporário no formato:
-- temp_{uuid}@pendente.local
-- Isso permite manter a constraint NOT NULL sem alterar a estrutura.

-- Verificar se a constraint de email único existe e está funcionando
-- (A constraint UNIQUE já deve existir, mas vamos garantir)

-- ============================================
-- 2. GARANTIR ÍNDICE PARA BUSCA POR TELEFONE NO ATLETA
-- ============================================
-- Criar índice para melhorar performance na busca por telefone normalizado
-- Isso é usado em: buscar-pendente, completar-cadastro, buscar-por-telefone

-- Índice para busca rápida por telefone normalizado
CREATE INDEX IF NOT EXISTS idx_atleta_fone_normalizado 
ON "Atleta" (REGEXP_REPLACE(fone, '[^0-9]', '', 'g'));

-- Índice para buscar atletas com usuário vinculado
CREATE INDEX IF NOT EXISTS idx_atleta_usuario_id 
ON "Atleta"("usuarioId") 
WHERE "usuarioId" IS NOT NULL;

-- Índice para buscar usuários pendentes (com email temporário)
CREATE INDEX IF NOT EXISTS idx_user_email_pendente 
ON "User"(email) 
WHERE email LIKE 'temp_%@pendente.local';

-- ============================================
-- 3. GARANTIR CONSTRAINT DE TELEFONE ÚNICO
-- ============================================
-- Não permitir múltiplos atletas com o mesmo telefone
-- Isso é validado na aplicação, mas podemos adicionar uma constraint única
-- se a tabela não tiver muitos dados duplicados

-- Verificar se já existe constraint única no telefone
-- Se não existir e não houver dados duplicados, podemos criar:
-- ALTER TABLE "Atleta" ADD CONSTRAINT unique_atleta_fone 
-- UNIQUE (REGEXP_REPLACE(fone, '[^0-9]', '', 'g'));
-- 
-- NOTA: Esta constraint pode falhar se já existirem telefones duplicados.
-- Execute primeiro uma query para verificar:
-- SELECT REGEXP_REPLACE(fone, '[^0-9]', '', 'g') as telefone_normalizado, COUNT(*) 
-- FROM "Atleta" 
-- WHERE fone IS NOT NULL 
-- GROUP BY REGEXP_REPLACE(fone, '[^0-9]', '', 'g') 
-- HAVING COUNT(*) > 1;

-- ============================================
-- 4. FUNÇÃO AUXILIAR PARA NORMALIZAR TELEFONE
-- ============================================
-- Função para normalizar telefone (remover caracteres não numéricos)
-- Útil para queries e validações

CREATE OR REPLACE FUNCTION normalizar_telefone(telefone_input TEXT)
RETURNS TEXT AS $$
BEGIN
  IF telefone_input IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN REGEXP_REPLACE(telefone_input, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 5. VIEW PARA USUÁRIOS PENDENTES
-- ============================================
-- View para facilitar consulta de usuários pendentes (incompletos)

CREATE OR REPLACE VIEW "vw_usuarios_pendentes" AS
SELECT 
  u.id as "usuarioId",
  u.name as "nomeUsuario",
  u.email as "emailTemporario",
  u.role,
  u."createdAt" as "dataCriacao",
  a.id as "atletaId",
  a.nome as "nomeAtleta",
  a.fone as "telefone",
  normalizar_telefone(a.fone) as "telefoneNormalizado"
FROM "User" u
INNER JOIN "Atleta" a ON a."usuarioId" = u.id
WHERE u.email LIKE 'temp_%@pendente.local'
  AND u.password IS NULL;

-- Comentário na view
COMMENT ON VIEW "vw_usuarios_pendentes" IS 'View para listar usuários pendentes (incompletos) que aguardam vínculo pelo telefone';

-- ============================================
-- 6. FUNÇÃO PARA VERIFICAR SE TELEFONE JÁ EXISTE
-- ============================================
-- Função auxiliar para verificar se um telefone já está cadastrado

CREATE OR REPLACE FUNCTION telefone_ja_cadastrado(telefone_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  telefone_normalizado TEXT;
  existe BOOLEAN;
BEGIN
  telefone_normalizado := normalizar_telefone(telefone_input);
  
  IF telefone_normalizado IS NULL OR telefone_normalizado = '' THEN
    RETURN FALSE;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 
    FROM "Atleta" 
    WHERE normalizar_telefone(fone) = telefone_normalizado
      AND fone IS NOT NULL
  ) INTO existe;
  
  RETURN existe;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION normalizar_telefone(TEXT) IS 'Normaliza telefone removendo caracteres não numéricos';
COMMENT ON FUNCTION telefone_ja_cadastrado(TEXT) IS 'Verifica se um telefone já está cadastrado em algum atleta';

-- ============================================
-- 8. QUERIES ÚTEIS PARA ADMINISTRAÇÃO
-- ============================================

-- Query para listar todos os usuários pendentes:
-- SELECT * FROM "vw_usuarios_pendentes" ORDER BY "dataCriacao" DESC;

-- Query para contar usuários pendentes:
-- SELECT COUNT(*) FROM "vw_usuarios_pendentes";

-- Query para verificar telefones duplicados (antes de criar constraint única):
-- SELECT normalizar_telefone(fone) as telefone, COUNT(*) as quantidade
-- FROM "Atleta"
-- WHERE fone IS NOT NULL
-- GROUP BY normalizar_telefone(fone)
-- HAVING COUNT(*) > 1
-- ORDER BY quantidade DESC;

-- Query para encontrar usuário pendente por telefone:
-- SELECT * FROM "vw_usuarios_pendentes" 
-- WHERE "telefoneNormalizado" = normalizar_telefone('51999999999');

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
-- Após executar este script, o sistema estará pronto para:
-- 1. Criar usuários incompletos via POST /api/user/criar-incompleto
-- 2. Buscar usuários pendentes via POST /api/user/buscar-pendente
-- 3. Completar cadastro via POST /api/user/completar-cadastro
-- 
-- IMPORTANTE: 
-- - Usuários incompletos têm email no formato: temp_{uuid}@pendente.local
-- - Senha é NULL para usuários incompletos
-- - Telefone é armazenado no Atleta, não no User
-- - Telefone deve ser único (validado na aplicação)

