# Implementação: Sistema de Notificação de Agendamentos

## ✅ O que foi implementado

Sistema completo de lembretes de agendamento via WhatsApp (Gzappy) com controle granular por arena e preferências do atleta.

## 📋 Migrations Criadas

### 1. `add_lembretes_agendamento_point.sql`
Adiciona campos na tabela `Point` (Arena):
- `enviarLembretesAgendamento` (boolean, default: false) - Habilita/desabilita envio de lembretes
- `antecedenciaLembrete` (integer, default: 8) - Antecedência em horas (ex: 8, 24)

### 2. `add_aceita_lembretes_atleta.sql`
Adiciona campo na tabela `Atleta`:
- `aceitaLembretesAgendamento` (boolean, default: false) - Se o atleta aceita receber lembretes

### 3. `add_notificacao_agendamento.sql`
Cria tabela `NotificacaoAgendamento`:
- Controla quais notificações já foram enviadas
- Evita duplicatas
- Registra histórico

## 🔧 Configuração

### 1. Executar Migrations

Execute as migrations no banco de dados na ordem:
```sql
-- 1. Configurações da arena
\i migrations/add_lembretes_agendamento_point.sql

-- 2. Preferência do atleta
\i migrations/add_aceita_lembretes_atleta.sql

-- 3. Tabela de controle
\i migrations/add_notificacao_agendamento.sql
```

### 2. Configurar Variável de Ambiente (Opcional)

Para produção, adicione no `.env` ou nas variáveis de ambiente da Vercel:
```
CRON_SECRET=sua_chave_secreta_aqui
```

**Nota**: Se não configurar `CRON_SECRET`, a rota funcionará sem autenticação (apenas para testes).

### 3. Chamar Manualmente (Para Testes)

Como o Vercel Cron é pago, você pode chamar a rota manualmente:

**Com autenticação (se CRON_SECRET configurado):**
```bash
curl -X GET \
  -H "Authorization: Bearer sua_chave_secreta" \
  https://carlaobtonline.vercel.app/api/cron/verificar-notificacoes-agendamento
```

**Sem autenticação (se CRON_SECRET não configurado):**
```bash
curl -X GET \
  https://carlaobtonline.vercel.app/api/cron/verificar-notificacoes-agendamento
```

### 4. Configurar Vercel Cron (Opcional - Requer Plano Pago)

Para rodar automaticamente, adicione no `vercel.json`:
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

## 🎯 Como Funciona

### Para o Gestor da Arena:

1. **Habilitar lembretes:**
   - Acessar configurações da arena
   - Ativar `enviarLembretesAgendamento`
   - Definir `antecedenciaLembrete` (ex: 8 horas)

2. **Requisitos:**
   - Arena deve ter Gzappy configurado e ativo
   - `gzappyAtivo = true` na tabela Point

### Para o Atleta:

1. **Aceitar lembretes:**
   - Acessar perfil do atleta
   - Ativar `aceitaLembretesAgendamento`
   - Por padrão é `false` (não aceita)

2. **Requisitos:**
   - Ter telefone cadastrado (`atleta.fone`)
   - Ter flag `aceitaLembretesAgendamento = true`

### Fluxo de Notificação:

1. **Cron roda a cada hora** (00:00, 01:00, 02:00, etc.)
2. **Para cada arena com lembretes habilitados:**
   - Busca agendamentos confirmados que estão entre `(antecedencia-1h)` e `antecedencia` no futuro
   - Exemplo: Se antecedência é 8h, busca entre 7h e 8h no futuro
3. **Filtra agendamentos:**
   - Status = 'CONFIRMADO'
   - Atleta aceita lembretes OU usuário tem WhatsApp
   - Ainda não recebeu notificação deste tipo
4. **Envia via Gzappy:**
   - Usa credenciais da arena (`gzappyApiKey`, `gzappyInstanceId`)
   - Formata número para padrão internacional
   - Envia mensagem personalizada
5. **Registra notificação:**
   - Salva em `NotificacaoAgendamento` para evitar duplicatas

## 📱 Exemplo de Mensagem

```
🏸 *Lembrete de Agendamento*

Olá João!

Você tem um agendamento em *8 horas*:

📅 Data: 20/12/2024
🕐 Horário: 14:00
⏱️ Duração: 1h30
🏟️ Quadra: Quadra 1
📍 Arena: Arena Central

Não esqueça! 😊
```

## 🔍 Logs e Monitoramento

A rota retorna JSON com estatísticas:
```json
{
  "sucesso": true,
  "totalArenas": 3,
  "notificacoesEnviadas": 5,
  "erros": []
}
```

Logs no console mostram:
- `[NOTIFICAÇÃO] Arena X: Y agendamentos para notificar`
- `[NOTIFICAÇÃO] ✅ Enviada para agendamento X`
- `[NOTIFICAÇÃO] ❌ Falha ao enviar para agendamento X`

## 🛠️ Próximos Passos (Frontend)

### 1. Interface para Gestor (Arena)

Adicionar na página de configurações da arena:
- Checkbox: "Enviar lembretes de agendamento"
- Input: "Antecedência (horas)" - número, padrão 8

### 2. Interface para Atleta

Adicionar no perfil do atleta:
- Checkbox: "Aceitar receber lembretes de agendamento"
- Por padrão desmarcado (false)

### 3. Exemplo de Componente (React)

```tsx
// Para gestor
<div>
  <label>
    <input 
      type="checkbox" 
      checked={arena.enviarLembretesAgendamento}
      onChange={(e) => atualizarArena({ 
        enviarLembretesAgendamento: e.target.checked 
      })}
    />
    Enviar lembretes de agendamento
  </label>
  {arena.enviarLembretesAgendamento && (
    <input 
      type="number" 
      value={arena.antecedenciaLembrete || 8}
      onChange={(e) => atualizarArena({ 
        antecedenciaLembrete: parseInt(e.target.value) 
      })}
      min="1"
      placeholder="Horas antes (ex: 8)"
    />
  )}
</div>

// Para atleta
<div>
  <label>
    <input 
      type="checkbox" 
      checked={atleta.aceitaLembretesAgendamento}
      onChange={(e) => atualizarAtleta({ 
        aceitaLembretesAgendamento: e.target.checked 
      })}
    />
    Aceitar receber lembretes de agendamento
  </label>
</div>
```

## 🔒 Segurança

- Rota protegida com `CRON_SECRET`
- Validação de autorização via header `Authorization: Bearer {CRON_SECRET}`
- Apenas Vercel Cron (ou requisições autorizadas) podem chamar

## 📊 Melhorias Futuras

1. **Múltiplas antecedências:**
   - Permitir configurar várias (ex: 24h e 8h)
   - Enviar notificações em diferentes momentos

2. **Templates personalizados:**
   - Cada arena pode ter seu próprio template
   - Variáveis dinâmicas na mensagem

3. **Histórico e estatísticas:**
   - Dashboard mostrando notificações enviadas
   - Taxa de sucesso/falha

4. **Canais alternativos:**
   - Email além de WhatsApp
   - SMS como fallback

5. **Confirmação de leitura:**
   - Link para confirmar presença
   - Link para cancelar agendamento

## 🐛 Troubleshooting

### Notificações não estão sendo enviadas:

1. Verificar se cron está rodando:
   - Ver logs da Vercel
   - Testar manualmente: `GET /api/cron/verificar-notificacoes-agendamento` com header `Authorization: Bearer {CRON_SECRET}`

2. Verificar configurações da arena:
   - `enviarLembretesAgendamento = true`
   - `gzappyAtivo = true`
   - `antecedenciaLembrete` definido

3. Verificar preferência do atleta:
   - `aceitaLembretesAgendamento = true`
   - Telefone cadastrado

4. Verificar Gzappy:
   - Credenciais configuradas
   - API Key válida

### Testar Manualmente

```bash
curl -X GET \
  -H "Authorization: Bearer sua_chave_secreta" \
  https://carlaobtonline.vercel.app/api/cron/verificar-notificacoes-agendamento
```

