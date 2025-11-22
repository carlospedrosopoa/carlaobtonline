# Integração WhatsApp - Sistema de Notificações

Este documento descreve a implementação da integração com WhatsApp para envio de notificações sobre agendamentos.

## Estrutura Implementada

### 1. Banco de Dados

Foi adicionado o campo `whatsapp` na tabela `User` para armazenar o número do WhatsApp do gestor.

**Migration SQL:**
```sql
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS whatsapp TEXT;

CREATE INDEX IF NOT EXISTS idx_user_whatsapp ON "User"(whatsapp) WHERE whatsapp IS NOT NULL;
```

**Formato do número:**
- Apenas números (ex: `5511999999999`)
- Formato internacional sem caracteres especiais
- Código do país + DDD + número

### 2. Serviço de WhatsApp (`src/lib/whatsappService.ts`)

O serviço fornece funções para:
- `enviarMensagemWhatsApp()`: Envia mensagem para um número
- `obterWhatsAppGestor()`: Obtém o WhatsApp do gestor de uma arena
- `formatarNumeroWhatsApp()`: Formata número para padrão internacional
- `notificarNovoAgendamento()`: Envia notificação de novo agendamento
- `notificarCancelamentoAgendamento()`: Envia notificação de cancelamento

**Status atual:**
- ✅ Estrutura criada
- ⚠️ Integração real com API de WhatsApp ainda não implementada (apenas logs no console)
- 📝 Pronta para integração com APIs como:
  - WhatsApp Business API (Meta)
  - Evolution API
  - Twilio WhatsApp API

### 3. Integração nas APIs

As notificações são enviadas automaticamente quando:
- ✅ Novo agendamento é criado (`POST /api/agendamento`)
- ✅ Agendamento é cancelado (`POST /api/agendamento/[id]/cancelar`)

**Características:**
- Envio assíncrono (não bloqueia a resposta da API)
- Erros não críticos (não quebram o fluxo principal)
- Logs de erro para debug

### 4. Interface de Usuário

**Página de Gestores (`/app/admin/organizers`):**
- ✅ Campo WhatsApp no formulário de criação
- ✅ Campo WhatsApp no formulário de edição
- ✅ Exibição do WhatsApp na lista de gestores
- ✅ Validação automática (apenas números)

### 5. Mensagens Enviadas

**Novo Agendamento:**
```
🏸 *Novo Agendamento Confirmado*

Quadra: [Nome da Quadra]
Data: [DD/MM/AAAA]
Horário: [HH:MM]
Duração: [Xh Ymin]
Cliente: [Nome do Cliente]
Telefone: [Telefone] (se disponível)

Agendamento confirmado com sucesso! ✅
```

**Cancelamento:**
```
❌ *Agendamento Cancelado*

Quadra: [Nome da Quadra]
Data: [DD/MM/AAAA]
Horário: [HH:MM]
Cliente: [Nome do Cliente]

O agendamento foi cancelado.
```

## Próximos Passos

### Para Implementar a Integração Real:

1. **Escolher uma API de WhatsApp:**
   - **WhatsApp Business API (Meta)**: Oficial, requer aprovação
   - **Evolution API**: Open source, mais flexível
   - **Twilio WhatsApp API**: Pago, mas simples de integrar

2. **Configurar Variáveis de Ambiente:**
   ```env
   # Exemplo para Evolution API
   EVOLUTION_API_URL=http://localhost:8080
   EVOLUTION_API_KEY=sua-chave-aqui
   
   # Exemplo para Twilio
   TWILIO_ACCOUNT_SID=seu-sid
   TWILIO_AUTH_TOKEN=seu-token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

3. **Implementar a função `enviarMensagemWhatsApp()`:**
   - Descomentar e adaptar o exemplo no arquivo `src/lib/whatsappService.ts`
   - Seguir a documentação da API escolhida

4. **Testar:**
   - Criar um agendamento de teste
   - Verificar se a mensagem é recebida no WhatsApp do gestor
   - Verificar logs de erro se necessário

## Arquivos Modificados/Criados

### Criados:
- `MIGRACAO_WHATSAPP_GESTOR.md` - Documentação da migration
- `src/lib/whatsappService.ts` - Serviço de WhatsApp
- `INTEGRACAO_WHATSAPP.md` - Este arquivo

### Modificados:
- `src/lib/userService.ts` - Adicionado suporte a campo `whatsapp`
- `src/app/api/user/[id]/route.ts` - Aceita campo `whatsapp` na atualização
- `src/app/api/agendamento/route.ts` - Envia notificação ao criar agendamento
- `src/app/api/agendamento/[id]/cancelar/route.ts` - Envia notificação ao cancelar
- `src/app/app/admin/organizers/page.tsx` - Interface para cadastrar/editar WhatsApp
- `src/services/userService.ts` - Interface atualizada com `whatsapp`

## Observações Importantes

1. **Não bloqueia o fluxo principal**: Se o envio de WhatsApp falhar, o agendamento ainda é criado/cancelado normalmente.

2. **Logs para debug**: Todos os erros são logados no console para facilitar o debug.

3. **Formato do número**: O sistema remove automaticamente caracteres não numéricos e tenta formatar para padrão internacional.

4. **Opcional**: O campo WhatsApp é opcional - se não for preenchido, as notificações simplesmente não serão enviadas.

5. **Apenas para gestores**: Apenas usuários com role `ORGANIZER` podem ter WhatsApp cadastrado e receber notificações.

