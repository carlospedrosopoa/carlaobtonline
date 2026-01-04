-- Migration: Criar view vw_usuarios_pendentes
-- Data: 2025-01-21
-- Descrição: Cria view para facilitar consulta de usuários pendentes (incompletos) que aguardam vínculo pelo telefone

-- Criar função auxiliar para normalizar telefone (se não existir)
-- Esta função é necessária para a view funcionar corretamente
CREATE OR REPLACE FUNCTION normalizar_telefone(telefone_input TEXT)
RETURNS TEXT AS $$
BEGIN
  IF telefone_input IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN REGEXP_REPLACE(telefone_input, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Criar view para usuários pendentes
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

-- Comentário na função
COMMENT ON FUNCTION normalizar_telefone(TEXT) IS 'Normaliza telefone removendo caracteres não numéricos';


