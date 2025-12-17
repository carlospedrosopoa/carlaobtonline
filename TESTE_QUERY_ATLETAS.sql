-- Query para testar a busca de atletas com email do usuário
-- Substitua 'SEU_POINT_ID_AQUI' pelo ID da arena que você quer testar

-- Para ORGANIZER (substitua o pointId):
SELECT a.*, 
       u.id as "usuario_id", 
       u.name as "usuario_name", 
       u.email as "usuario_email", 
       u.role as "usuario_role" 
FROM "Atleta" a 
LEFT JOIN "User" u ON a."usuarioId" = u.id 
LEFT JOIN "AtletaPoint" ap ON a.id = ap."atletaId"
WHERE (a."pointIdPrincipal" = 'SEU_POINT_ID_AQUI' OR ap."pointId" = 'SEU_POINT_ID_AQUI')
ORDER BY a.nome ASC;

-- Para ADMIN (todos os atletas):
SELECT a.*, 
       u.id as "usuario_id", 
       u.name as "usuario_name", 
       u.email as "usuario_email", 
       u.role as "usuario_role" 
FROM "Atleta" a 
LEFT JOIN "User" u ON a."usuarioId" = u.id 
ORDER BY a.nome ASC;

-- Query para verificar se o email está sendo retornado corretamente:
-- (Substitua 'SEU_POINT_ID_AQUI' pelo ID da arena)
SELECT 
  a.id,
  a.nome,
  a.fone,
  u.id as "usuario_id",
  u.name as "usuario_name",
  u.email as "usuario_email",
  u.role as "usuario_role",
  CASE 
    WHEN u.email IS NULL THEN 'SEM EMAIL'
    WHEN u.email LIKE 'temp_%@pendente.local' THEN 'EMAIL TEMPORARIO'
    ELSE 'EMAIL NORMAL'
  END as "status_email"
FROM "Atleta" a 
LEFT JOIN "User" u ON a."usuarioId" = u.id 
LEFT JOIN "AtletaPoint" ap ON a.id = ap."atletaId"
WHERE (a."pointIdPrincipal" = 'SEU_POINT_ID_AQUI' OR ap."pointId" = 'SEU_POINT_ID_AQUI')
ORDER BY a.nome ASC;

-- Query para verificar atletas com usuarioId mas sem email (problema):
SELECT 
  a.id,
  a.nome,
  a.fone,
  a."usuarioId",
  u.id as "user_id",
  u.email as "user_email",
  u.name as "user_name"
FROM "Atleta" a 
LEFT JOIN "User" u ON a."usuarioId" = u.id 
WHERE a."usuarioId" IS NOT NULL
  AND u.email IS NULL
ORDER BY a.nome ASC;

-- Query para verificar atletas com email temporário:
SELECT 
  a.id,
  a.nome,
  a.fone,
  u.email as "usuario_email",
  u.name as "usuario_name"
FROM "Atleta" a 
INNER JOIN "User" u ON a."usuarioId" = u.id 
WHERE u.email LIKE 'temp_%@pendente.local'
ORDER BY a.nome ASC;

