# Configuração de Templates para Cards de Partida

## 📋 Visão Geral

O sistema agora suporta templates de fundo personalizados para os cards de partida. Cada partida pode ter seu próprio template, permitindo criar novos templates no futuro sem afetar jogos antigos.

## 🎯 Como Funciona

1. **Template Padrão**: Configurado via variável de ambiente `CARD_DEFAULT_TEMPLATE_URL`
2. **Template por Partida**: Quando um card é gerado pela primeira vez, o template usado é salvo na partida
3. **Prioridade**: Template da partida > Template padrão > Fundo programático

## 🚀 Configuração Inicial

### 1. Executar Migration

Primeiro, execute a migration para adicionar o campo `templateUrl` na tabela `Partida`:

```bash
npm run migrate:template
```

Ou execute manualmente o SQL em `MIGRACAO_CARD_TEMPLATE.sql`.

### 2. Configurar Template Padrão

#### Desenvolvimento Local

Adicione no arquivo `.env.local`:

```env
CARD_DEFAULT_TEMPLATE_URL=https://storage.googleapis.com/seu-bucket/templates/card-template-v1.png
```

#### Produção (Vercel)

1. Acesse **Settings → Environment Variables** no Vercel
2. Adicione a variável:
   - **Name**: `CARD_DEFAULT_TEMPLATE_URL`
   - **Value**: URL do template no GCS (ex: `https://storage.googleapis.com/seu-bucket/templates/card-template-v1.png`)
   - **Environment**: Production (e Preview se necessário)
3. Faça um **Redeploy**

### 3. Upload do Template para GCS

Para fazer upload de um template:

1. Use a rota `/api/upload/image` com `folder=templates`
2. Ou faça upload manualmente no Google Cloud Storage
3. Certifique-se de que a imagem é pública
4. Copie a URL pública e use como `CARD_DEFAULT_TEMPLATE_URL`

**Exemplo de upload via API:**

```bash
curl -X POST http://localhost:3000/api/upload/image \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "file=@card-template.png" \
  -F "folder=templates"
```

## 📝 Estrutura de Dados

### Tabela Partida

A tabela `Partida` agora possui o campo:

```sql
templateUrl TEXT NULL
```

- **NULL**: Partida ainda não teve card gerado ou foi criada antes da migration
- **URL**: URL do template usado para gerar o card desta partida

### Interface TypeScript

```typescript
interface PartidaParaCard {
  id: string;
  data: Date;
  local: string;
  templateUrl: string | null; // URL do template usado
  // ... outros campos
}
```

## 🔧 API Endpoints

### GET `/api/card/partida/[id]`

Gera o card da partida usando:
1. Template salvo na partida (se existir)
2. Template padrão (`CARD_DEFAULT_TEMPLATE_URL`)
3. Fundo programático (fallback)

**Comportamento:**
- Se a partida não tem `templateUrl` e existe template padrão, salva o padrão na partida
- Sempre usa o template salvo na partida em gerações futuras

### GET `/api/card/template`

Retorna a URL do template padrão atual (apenas ADMIN).

**Resposta:**
```json
{
  "templateUrl": "https://storage.googleapis.com/...",
  "mensagem": "Template padrão configurado"
}
```

### PUT `/api/card/template`

Informa como configurar o template padrão (apenas ADMIN).

**Nota**: Esta rota não altera a variável de ambiente em runtime. Você deve configurar manualmente no Vercel ou `.env.local`.

## 🎨 Criando Novos Templates

### Requisitos do Template

- **Dimensões**: 1080x1920px (formato vertical)
- **Formato**: PNG (recomendado) ou JPG
- **Tamanho**: Máximo 5MB
- **Posições dos Elementos**:
  - Título: Centro superior (y: ~100)
  - Data/Hora: Centro superior (y: ~150)
  - Local: Centro superior (y: ~200)
  - Fotos dos atletas:
    - Atleta 1: (70, 380)
    - Atleta 2: (70, 680)
    - Atleta 3: (770, 380)
    - Atleta 4: (770, 680)
  - Placar: Centro (y: ~250)
  - VS: Centro (y: ~320)

### Processo

1. Crie o template no seu editor de imagens favorito
2. Faça upload para GCS na pasta `templates/`
3. Configure a URL como `CARD_DEFAULT_TEMPLATE_URL`
4. Novos cards usarão o novo template
5. Cards antigos continuarão usando seus templates originais

## 🔄 Migração de Templates Antigos

Se você já tem partidas criadas e quer aplicar um template padrão a elas:

```sql
-- Atualizar todas as partidas sem template com o template padrão
UPDATE "Partida" 
SET "templateUrl" = 'https://storage.googleapis.com/seu-bucket/templates/template-v1.png'
WHERE "templateUrl" IS NULL;
```

**⚠️ Atenção**: Isso afetará todas as partidas antigas. Considere criar um script de migração específico se necessário.

## 📊 Monitoramento

### Verificar Templates Usados

```sql
-- Listar partidas com template
SELECT id, "templateUrl", "createdAt" 
FROM "Partida" 
WHERE "templateUrl" IS NOT NULL 
ORDER BY "createdAt" DESC;

-- Contar partidas por template
SELECT "templateUrl", COUNT(*) 
FROM "Partida" 
WHERE "templateUrl" IS NOT NULL 
GROUP BY "templateUrl";
```

## 🐛 Troubleshooting

### Problema: Template não carrega

**Soluções:**
1. Verifique se a URL está correta e acessível
2. Confirme que a imagem é pública no GCS
3. Verifique logs do servidor para erros de carregamento
4. Teste a URL diretamente no navegador

### Problema: Template não é salvo na partida

**Soluções:**
1. Verifique se a migration foi executada
2. Confirme que o campo `templateUrl` existe na tabela
3. Verifique logs do servidor para erros de SQL

### Problema: Cards antigos não usam novo template

**Esperado**: Cards antigos mantêm seus templates originais. Isso é por design para preservar a aparência histórica.

**Se quiser atualizar:**
- Execute um UPDATE SQL manual (veja seção "Migração de Templates Antigos")
- Ou regenere os cards (eles usarão o template salvo na partida)

## ✅ Checklist

- [ ] Migration executada (`npm run migrate:template`)
- [ ] Template padrão configurado (`CARD_DEFAULT_TEMPLATE_URL`)
- [ ] Template uploadado para GCS
- [ ] URL do template testada e acessível
- [ ] Teste de geração de card funcionando
- [ ] Verificação de que template é salvo na partida

## 📚 Arquivos Relacionados

- `MIGRACAO_CARD_TEMPLATE.sql` - SQL da migration
- `scripts/run-migration-template.js` - Script para executar migration
- `src/lib/cardService.ts` - Serviço de busca e salvamento de templates
- `src/lib/generateCard.ts` - Geração do card com template
- `src/app/api/card/template/route.ts` - API de gerenciamento de template

