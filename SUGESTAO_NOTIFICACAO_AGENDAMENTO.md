# Sugestão: Sistema de Notificação 8 Horas Antes do Agendamento

## Opções de Implementação

### Opção 1: Vercel Cron Jobs (Recomendado para Vercel)

**Vantagens:**
- Integrado com Vercel
- Não precisa de infraestrutura adicional
- Fácil de configurar
- Gratuito para uso básico

**Como funciona:**
1. Criar uma rota API `/api/cron/verificar-notificacoes-agendamento`
2. Configurar no `vercel.json` para rodar a cada hora
3. A rota verifica agendamentos que estão entre 7-8 horas no futuro
4. Envia notificações via WhatsApp/Email

**Estrutura:**

```typescript
// app/api/cron/verificar-notificacoes-agendamento/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { enviarMensagemWhatsApp } from '@/lib/whatsappService';

export async function GET(request: NextRequest) {
  // Verificar se é uma chamada do Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Buscar agendamentos confirmados que estão entre 7-8 horas no futuro
    const agora = new Date();
    const em7Horas = new Date(agora.getTime() + 7 * 60 * 60 * 1000);
    const em8Horas = new Date(agora.getTime() + 8 * 60 * 60 * 1000);

    const sql = `
      SELECT 
        a.id, a."dataHora", a.duracao,
        a."atletaId", a."usuarioId",
        at.nome as "atleta_nome", at.fone as "atleta_fone",
        u.name as "usuario_name", u.email as "usuario_email", u.whatsapp as "usuario_whatsapp",
        q.nome as "quadra_nome",
        p.nome as "point_nome", p.id as "point_id",
        n.id as "notificacao_id"
      FROM "Agendamento" a
      LEFT JOIN "Atleta" at ON a."atletaId" = at.id
      LEFT JOIN "User" u ON a."usuarioId" = u.id
      LEFT JOIN "Quadra" q ON a."quadraId" = q.id
      LEFT JOIN "Point" p ON q."pointId" = p.id
      LEFT JOIN "NotificacaoAgendamento" n ON n."agendamentoId" = a.id 
        AND n.tipo = 'LEMBRETE_8H' 
        AND n.enviada = false
      WHERE a.status = 'CONFIRMADO'
        AND a."dataHora" >= $1
        AND a."dataHora" <= $2
        AND n.id IS NULL
    `;

    const result = await query(sql, [
      em7Horas.toISOString(),
      em8Horas.toISOString()
    ]);

    const notificacoesEnviadas = [];

    for (const agendamento of result.rows) {
      // Determinar destinatário (atleta ou usuário)
      const telefone = agendamento.atleta_fone || agendamento.usuario_whatsapp;
      const nome = agendamento.atleta_nome || agendamento.usuario_name;

      if (!telefone) {
        console.log(`Agendamento ${agendamento.id} sem telefone para notificação`);
        continue;
      }

      // Formatar data/hora
      const dataHora = new Date(agendamento.dataHora);
      const dataFormatada = dataHora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const horaFormatada = dataHora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Enviar notificação
      try {
        await enviarMensagemWhatsApp({
          pointId: agendamento.point_id,
          destinatario: telefone,
          mensagem: `🏸 *Lembrete de Agendamento*\n\n` +
            `Olá ${nome}!\n\n` +
            `Você tem um agendamento em *8 horas*:\n\n` +
            `📅 Data: ${dataFormatada}\n` +
            `🕐 Horário: ${horaFormatada}\n` +
            `⏱️ Duração: ${agendamento.duracao} minutos\n` +
            `🏟️ Quadra: ${agendamento.quadra_nome}\n` +
            `📍 Arena: ${agendamento.point_nome}\n\n` +
            `Não esqueça! 😊`
        });

        // Registrar notificação enviada
        await query(
          `INSERT INTO "NotificacaoAgendamento" 
           (id, "agendamentoId", tipo, enviada, "dataEnvio", "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'LEMBRETE_8H', true, NOW(), NOW())`,
          [agendamento.id]
        );

        notificacoesEnviadas.push(agendamento.id);
      } catch (error) {
        console.error(`Erro ao enviar notificação para agendamento ${agendamento.id}:`, error);
      }
    }

    return NextResponse.json({
      sucesso: true,
      totalEncontrados: result.rows.length,
      notificacoesEnviadas: notificacoesEnviadas.length
    });
  } catch (error: any) {
    console.error('Erro ao verificar notificações:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Configuração no `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/verificar-notificacoes-agendamento",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Migration para tabela de notificações:**

```sql
-- migrations/add_notificacao_agendamento.sql
CREATE TABLE IF NOT EXISTS "NotificacaoAgendamento" (
  id TEXT PRIMARY KEY,
  "agendamentoId" TEXT NOT NULL REFERENCES "Agendamento"(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'LEMBRETE_8H', 'LEMBRETE_24H', etc.
  enviada BOOLEAN NOT NULL DEFAULT false,
  "dataEnvio" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificacao_agendamento ON "NotificacaoAgendamento"("agendamentoId", tipo, enviada);
```

---

### Opção 2: GitHub Actions (Alternativa Gratuita)

**Vantagens:**
- Totalmente gratuito
- Não depende da Vercel
- Pode rodar em qualquer horário

**Como funciona:**
1. Criar workflow `.github/workflows/notificacoes-agendamento.yml`
2. Workflow chama a API a cada hora
3. API verifica e envia notificações

**Estrutura:**

```yaml
# .github/workflows/notificacoes-agendamento.yml
name: Verificar Notificações Agendamento

on:
  schedule:
    - cron: '0 * * * *' # A cada hora
  workflow_dispatch: # Permite execução manual

jobs:
  verificar-notificacoes:
    runs-on: ubuntu-latest
    steps:
      - name: Chamar API de Notificações
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://carlaobtonline.vercel.app/api/cron/verificar-notificacoes-agendamento
```

---

### Opção 3: Serviço de Fila (Bull/BullMQ) - Mais Robusto

**Vantagens:**
- Mais controle sobre quando enviar
- Pode reagendar facilmente
- Melhor para volumes grandes

**Desvantagens:**
- Requer Redis
- Mais complexo de configurar

**Como funciona:**
1. Ao criar agendamento, agenda notificação para 8h antes
2. Job processa e envia notificação
3. Se falhar, pode tentar novamente

---

## Recomendação: Opção 1 (Vercel Cron)

**Por quê:**
- ✅ Já está na Vercel
- ✅ Integração nativa
- ✅ Sem infraestrutura adicional
- ✅ Fácil de manter

## Melhorias Futuras

1. **Notificações múltiplas:**
   - 24 horas antes
   - 8 horas antes
   - 1 hora antes

2. **Preferências do usuário:**
   - Permitir escolher se quer receber notificações
   - Escolher canal (WhatsApp, Email, SMS)

3. **Templates personalizados:**
   - Cada arena pode ter seu próprio template
   - Incluir link para cancelar/confirmar

4. **Histórico de notificações:**
   - Ver quais notificações foram enviadas
   - Estatísticas de abertura/clique

## Exemplo de Uso

```typescript
// Ao criar agendamento, já pode registrar que precisa notificar
await query(
  `INSERT INTO "NotificacaoAgendamento" 
   (id, "agendamentoId", tipo, enviada, "createdAt")
   VALUES (gen_random_uuid()::text, $1, 'LEMBRETE_8H', false, NOW())`,
  [agendamentoId]
);
```

## Segurança

- Usar `CRON_SECRET` para proteger a rota
- Validar origem das requisições
- Rate limiting para evitar abuso

## Monitoramento

- Logs de notificações enviadas
- Alertas se muitas falharem
- Dashboard de estatísticas

