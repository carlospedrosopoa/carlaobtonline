-- Migration: Criar tabela de configurações da plataforma
-- Data: 2025-01-21
-- Descrição: Tabela para armazenar configurações globais da plataforma Play Na Quadra
-- Essas configurações são gerenciadas pelo admin e usadas por recursos da plataforma

CREATE TABLE IF NOT EXISTS "PlatformConfig" (
  id SERIAL PRIMARY KEY,
  "chave" VARCHAR(255) UNIQUE NOT NULL,
  "valor" TEXT,
  "descricao" TEXT,
  "tipo" VARCHAR(50) DEFAULT 'texto', -- 'texto', 'numero', 'booleano', 'json'
  "categoria" VARCHAR(100) DEFAULT 'geral', -- 'geral', 'gzappy', 'email', 'pagamento', etc
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Criar índice para busca rápida por chave
CREATE INDEX IF NOT EXISTS "idx_platform_config_chave" ON "PlatformConfig"("chave");
CREATE INDEX IF NOT EXISTS "idx_platform_config_categoria" ON "PlatformConfig"("categoria");

-- Inserir configurações padrão do Gzappy para a plataforma
INSERT INTO "PlatformConfig" ("chave", "valor", "descricao", "tipo", "categoria")
VALUES 
  ('gzappy_api_key', '', 'JWT Token do Gzappy para funcionalidades da plataforma (recuperação de senha, notificações globais, etc)', 'texto', 'gzappy'),
  ('gzappy_instance_id', '', 'Instance ID do Gzappy para identificação (opcional)', 'texto', 'gzappy'),
  ('gzappy_ativo', 'false', 'Se o Gzappy está ativo para funcionalidades da plataforma', 'booleano', 'gzappy')
ON CONFLICT ("chave") DO NOTHING;

-- Comentário: Esta tabela armazena configurações globais da plataforma
-- As configurações são gerenciadas pelo admin e podem ser usadas por qualquer recurso da plataforma
-- Exemplos: Gzappy para recuperação de senha, configurações de email, etc.




