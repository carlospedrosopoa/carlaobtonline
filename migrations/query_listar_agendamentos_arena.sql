-- Query para listar agendamentos de uma arena específica
-- Substitua 'SEU_POINT_ID_AQUI' pelo ID da arena desejada

-- Versão COMPLETA (se as colunas ehAula e professorId existirem):
SELECT 
    a.id as "agendamento_id",
    a."dataHora",
    a.duracao,
    a."valorHora",
    a."valorCalculado",
    a."valorNegociado",
    a.status,
    a.observacoes,
    a."ehAula",
    a."recorrenciaId",
    a."createdAt",
    a."updatedAt",
    
    -- Dados da Quadra
    q.id as "quadra_id",
    q.nome as "quadra_nome",
    q.ativo as "quadra_ativo",
    
    -- Dados da Arena (Point)
    p.id as "arena_id",
    p.nome as "arena_nome",
    p."logoUrl" as "arena_logo",
    
    -- Dados do Cliente (User)
    u.id as "cliente_usuario_id",
    u.name as "cliente_nome",
    u.email as "cliente_email",
    
    -- Dados do Atleta
    at.id as "atleta_id",
    at.nome as "atleta_nome",
    at.fone as "atleta_telefone",
    
    -- Dados do Cliente Avulso (quando não há atleta cadastrado)
    a."nomeAvulso" as "cliente_avulso_nome",
    a."telefoneAvulso" as "cliente_avulso_telefone",
    
    -- Dados do Professor (se for aula)
    pr.id as "professor_id",
    pr.especialidade as "professor_especialidade",
    up.name as "professor_nome",
    up.email as "professor_email"

FROM "Agendamento" a
LEFT JOIN "Quadra" q ON a."quadraId" = q.id
LEFT JOIN "Point" p ON q."pointId" = p.id
LEFT JOIN "User" u ON a."usuarioId" = u.id
LEFT JOIN "Atleta" at ON a."atletaId" = at.id
LEFT JOIN "Professor" pr ON a."professorId" = pr.id
LEFT JOIN "User" up ON pr."userId" = up.id

-- Filtrar por arena específica (substitua pelo ID da arena)
WHERE p.id = 'SEU_POINT_ID_AQUI'

-- Filtrar apenas agendamentos confirmados (opcional - remova se quiser todos)
AND a.status = 'CONFIRMADO'

-- Filtrar apenas agendamentos futuros (opcional - remova se quiser todos)
AND a."dataHora" >= NOW()

-- Ordenar por data/hora
ORDER BY a."dataHora" ASC;

-- ============================================
-- Versão COMPATÍVEL (sem campos opcionais ehAula e professorId)
-- Use esta versão se as colunas ehAula e professorId não existirem
-- ============================================
/*
SELECT 
    a.id as "agendamento_id",
    a."dataHora",
    a.duracao,
    a."valorHora",
    a."valorCalculado",
    a."valorNegociado",
    a.status,
    a.observacoes,
    a."createdAt",
    a."updatedAt",
    
    -- Dados da Quadra
    q.id as "quadra_id",
    q.nome as "quadra_nome",
    q.ativo as "quadra_ativo",
    
    -- Dados da Arena (Point)
    p.id as "arena_id",
    p.nome as "arena_nome",
    p."logoUrl" as "arena_logo",
    
    -- Dados do Cliente (User)
    u.id as "cliente_usuario_id",
    u.name as "cliente_nome",
    u.email as "cliente_email",
    
    -- Dados do Atleta
    at.id as "atleta_id",
    at.nome as "atleta_nome",
    at.fone as "atleta_telefone",
    
    -- Dados do Cliente Avulso
    a."nomeAvulso" as "cliente_avulso_nome",
    a."telefoneAvulso" as "cliente_avulso_telefone"

FROM "Agendamento" a
LEFT JOIN "Quadra" q ON a."quadraId" = q.id
LEFT JOIN "Point" p ON q."pointId" = p.id
LEFT JOIN "User" u ON a."usuarioId" = u.id
LEFT JOIN "Atleta" at ON a."atletaId" = at.id

WHERE p.id = 'SEU_POINT_ID_AQUI'
AND a.status = 'CONFIRMADO'
AND a."dataHora" >= NOW()

ORDER BY a."dataHora" ASC;
*/

-- ============================================
-- EXEMPLO: Listar agendamentos de uma arena em um período específico
-- ============================================
/*
SELECT 
    a.id,
    a."dataHora",
    q.nome as quadra,
    p.nome as arena,
    COALESCE(at.nome, a."nomeAvulso", u.name) as cliente,
    COALESCE(at.fone, a."telefoneAvulso") as telefone,
    a.duracao,
    a."valorNegociado" as valor,
    a.status
FROM "Agendamento" a
LEFT JOIN "Quadra" q ON a."quadraId" = q.id
LEFT JOIN "Point" p ON q."pointId" = p.id
LEFT JOIN "User" u ON a."usuarioId" = u.id
LEFT JOIN "Atleta" at ON a."atletaId" = at.id
WHERE p.id = 'SEU_POINT_ID_AQUI'
AND a."dataHora" >= '2025-01-01T00:00:00Z'
AND a."dataHora" <= '2025-12-31T23:59:59Z'
AND a.status = 'CONFIRMADO'
ORDER BY a."dataHora" ASC;
*/

-- ============================================
-- Como encontrar o ID de uma arena (Point)
-- ============================================
/*
SELECT id, nome, "logoUrl" 
FROM "Point" 
WHERE nome ILIKE '%nome_da_arena%'
ORDER BY nome;
*/

