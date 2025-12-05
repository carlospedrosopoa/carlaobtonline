-- Script para adicionar campos de configuração WhatsApp na tabela Point
-- Execute este script no banco de dados para adicionar suporte a configurações WhatsApp por arena

-- Adicionar colunas de configuração WhatsApp
ALTER TABLE "Point" 
ADD COLUMN IF NOT EXISTS "whatsappAccessToken" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappBusinessAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappApiVersion" TEXT DEFAULT 'v21.0',
ADD COLUMN IF NOT EXISTS "whatsappAtivo" BOOLEAN DEFAULT false;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN "Point"."whatsappAccessToken" IS 'Token de acesso da API do WhatsApp Business (Meta)';
COMMENT ON COLUMN "Point"."whatsappPhoneNumberId" IS 'ID do número de telefone do WhatsApp Business';
COMMENT ON COLUMN "Point"."whatsappBusinessAccountId" IS 'ID da conta comercial do WhatsApp Business (opcional)';
COMMENT ON COLUMN "Point"."whatsappApiVersion" IS 'Versão da API do WhatsApp (padrão: v21.0)';
COMMENT ON COLUMN "Point"."whatsappAtivo" IS 'Indica se o WhatsApp está ativo para esta arena';

-- Criar índice para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_point_whatsapp_ativo ON "Point"("whatsappAtivo") WHERE "whatsappAtivo" = true;

