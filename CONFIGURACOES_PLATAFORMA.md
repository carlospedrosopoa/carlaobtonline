# Configurações da Plataforma

Este documento descreve o sistema de configurações globais da plataforma Play Na Quadra, gerenciadas pelo administrador.

## Visão Geral

As configurações da plataforma são armazenadas na tabela `PlatformConfig` e são usadas por recursos que precisam de configurações globais, não específicas de uma arena.

### Exemplos de Uso

- **Recuperação de Senha**: Usa configuração Gzappy da plataforma para enviar links via WhatsApp
- **Notificações Globais**: Mensagens enviadas pela plataforma (não por uma arena específica)
- **Configurações de Email**: Servidor SMTP, templates, etc.
- **Configurações de Pagamento**: Chaves de API globais, etc.

## Estrutura

### Tabela PlatformConfig

```sql
CREATE TABLE "PlatformConfig" (
  id SERIAL PRIMARY KEY,
  "chave" VARCHAR(255) UNIQUE NOT NULL,
  "valor" TEXT,
  "descricao" TEXT,
  "tipo" VARCHAR(50) DEFAULT 'texto', -- 'texto', 'numero', 'booleano', 'json'
  "categoria" VARCHAR(100) DEFAULT 'geral', -- 'geral', 'gzappy', 'email', 'pagamento', etc
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Configurações Padrão

#### Gzappy (categoria: 'gzappy')

- `gzappy_api_key`: JWT Token do Gzappy para funcionalidades da plataforma
- `gzappy_instance_id`: Instance ID do Gzappy (opcional)
- `gzappy_ativo`: Se o Gzappy está ativo para funcionalidades da plataforma (true/false)

## API Endpoints

### Listar Configurações

**GET** `/api/admin/platform-config`

**Query Parameters:**
- `categoria` (opcional): Filtrar por categoria
- `chave` (opcional): Buscar configuração específica

**Resposta:**
```json
{
  "configuracoes": [
    {
      "id": 1,
      "chave": "gzappy_api_key",
      "valor": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "descricao": "JWT Token do Gzappy para funcionalidades da plataforma",
      "tipo": "texto",
      "categoria": "gzappy",
      "createdAt": "2025-01-21T10:00:00Z",
      "updatedAt": "2025-01-21T10:00:00Z"
    }
  ]
}
```

### Criar/Atualizar Configuração

**POST** `/api/admin/platform-config`

**Body:**
```json
{
  "chave": "gzappy_api_key",
  "valor": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "descricao": "JWT Token do Gzappy para funcionalidades da plataforma",
  "tipo": "texto",
  "categoria": "gzappy"
}
```

### Obter Configuração Específica

**GET** `/api/admin/platform-config/[chave]`

**Exemplo:** `GET /api/admin/platform-config/gzappy_api_key`

### Atualizar Configuração Específica

**PUT** `/api/admin/platform-config/[chave]`

**Body:**
```json
{
  "valor": "novo_valor",
  "descricao": "Nova descrição (opcional)",
  "tipo": "texto (opcional)",
  "categoria": "gzappy (opcional)"
}
```

## Uso no Código

### Obter Configuração

```typescript
import { obterConfiguracao } from '@/lib/platformConfig';

const apiKey = await obterConfiguracao('gzappy_api_key');
```

### Obter Configurações do Gzappy

```typescript
import { obterConfiguracoesGzappyPlataforma } from '@/lib/platformConfig';

const config = await obterConfiguracoesGzappyPlataforma();
// { apiKey: string | null, instanceId: string | null, ativo: boolean }
```

### Definir Configuração

```typescript
import { definirConfiguracao } from '@/lib/platformConfig';

await definirConfiguracao(
  'gzappy_api_key',
  'valor',
  'Descrição',
  'texto',
  'gzappy'
);
```

## Ordem de Prioridade (Gzappy)

Quando o `enviarMensagemGzappy` é chamado, a ordem de busca das credenciais é:

1. **Point específico** (se `pointId` fornecido): Busca nas configurações da arena
2. **Plataforma**: Busca nas configurações da plataforma (`PlatformConfig`)
3. **Variáveis de ambiente**: Fallback para `GZAPPY_API_KEY` e `GZAPPY_INSTANCE_ID`

## Recuperação de Senha

A recuperação de senha usa **sempre** a configuração da plataforma, não de uma arena específica. Isso garante que:

- O link de recuperação seja enviado pela plataforma
- Não dependa de configurações de arenas individuais
- Funcione mesmo se o usuário não tiver nenhuma arena associada

## Migração

Execute a migration para criar a tabela:

```bash
psql -d seu_banco -f migrations/create_platform_config.sql
```

Ou execute diretamente no banco:

```sql
-- Ver migrations/create_platform_config.sql
```

## Segurança

- Apenas usuários com role `ADMIN` podem gerenciar configurações
- As configurações sensíveis (como API keys) devem ser tratadas com cuidado
- Considere usar variáveis de ambiente para valores muito sensíveis

## Exemplos de Uso

### Configurar Gzappy para Recuperação de Senha

1. Acesse como ADMIN
2. Faça POST para `/api/admin/platform-config`:

```json
{
  "chave": "gzappy_api_key",
  "valor": "seu_jwt_token_aqui",
  "descricao": "JWT Token do Gzappy para funcionalidades da plataforma",
  "tipo": "texto",
  "categoria": "gzappy"
}
```

3. Ative o Gzappy:

```json
{
  "chave": "gzappy_ativo",
  "valor": "true",
  "descricao": "Se o Gzappy está ativo para funcionalidades da plataforma",
  "tipo": "booleano",
  "categoria": "gzappy"
}
```

### Verificar Configurações

```bash
curl -X GET "https://carlaobtonline.vercel.app/api/admin/platform-config?categoria=gzappy" \
  -H "Authorization: Bearer seu_token_admin"
```

