# Resumo de Contexto - Agendamentos, Gzappy e Cron

Este arquivo resume o estado atual do projeto para retomada em um novo chat.

## Objetivo do ciclo

Implementar e estabilizar o fluxo de confirmacoes de agendamento via WhatsApp/Gzappy, com:

- mensagens informativas para criacao e alteracao de agendamento
- mensagens interativas com resposta `1` e `2` para confirmacao
- processamento inbound via webhook da Gzappy
- tela para o gestor acompanhar confirmacoes
- cron no Vercel para disparos automaticos

## Regra de negocio atual

- `NOVO_AGENDAMENTO`: mensagem informativa
- `ALTERACAO_AGENDAMENTO`: mensagem informativa
- `Enviar Confirmacao` manual na agenda: mensagem interativa
- cron automatico:
  - se `antecedenciaLembrete <= 12h`: mensagem interativa
  - se `antecedenciaLembrete > 12h`: mensagem informativa
- o cron nao deve reenviar confirmacao interativa se ja existir interacao relevante com status:
  - `AGUARDANDO_ENVIO`
  - `AGUARDANDO_RESPOSTA`
  - `CONFIRMADO_RECEBIMENTO`
  - `SOLICITOU_CONTATO`

## Situacao importante de horario

O projeto grava `dataHora` no banco em UTC, mas tratando a hora local como "naive". Por isso:

- a exibicao na UI foi ajustada para nao converter fuso indevidamente
- o cron foi ajustado para usar referencia de `America/Sao_Paulo` e comparar no mesmo formato "naive"

## Fluxo atual de confirmacao

### Envio outbound

- criacao/alteracao: sem `1` e `2`
- confirmacao manual e confirmacao proxima via cron: com `1` e `2`
- o contexto da interacao deve ser persistido antes do envio

### Recebimento inbound

- webhook recebe `messages_upsert`
- resposta `1` vira `CONFIRMADO_RECEBIMENTO`
- resposta `2` vira `SOLICITOU_CONTATO`
- houve casos em que a Gzappy enviou `remote_jid` com `@lid`, sem telefone real
- o webhook foi ajustado para desempatar por proximidade de tempo quando isso acontecer

## Tela de acompanhamento

Foi criada uma tela dedicada para o gestor:

- rota: `/app/arena/agendamentos/agenda/confirmacoes`
- acessada por botao `Acompanhar Confirmacoes`
- mostra contadores por status
- mostra lista das interacoes
- permite `Confirmar manualmente`
- navega de 1 em 1 dia
- ao clicar nos cards de contador, filtra a lista por status

## Cron no Vercel

Configuracao esperada:

- rota: `/api/cron/verificar-notificacoes-agendamento`
- schedule: `0 * * * *`
- executa de hora em hora em UTC
- `CRON_SECRET` configurado no Vercel

Observacao importante:

- em browser, abrir a rota sem header retorna `Unauthorized`, o que e esperado
- para teste manual pode usar `?test=true`

## Problema importante descoberto

Houve um periodo em que:

- GitHub mostrava `main` e `regioes` alinhadas
- mas a producao ainda executava um bundle antigo da rota do cron

Isso foi comprovado pelos logs antigos do cron e pelo erro:

- `TypeError: e.dataHora.match is not a function`

Para forcar diff explicito e facilitar validacao de deploy, foi feito um ajuste adicional com:

- log de versao da logica do cron
- parse de `dataHora` mais robusto

## Estado atual confirmado

O problema do cron em producao foi resolvido.

Confirmacoes deste estado:

- o cron no Vercel esta habilitado
- a configuracao de `CRON_SECRET` esta presente
- apos redeploy e novo teste, o cron passou a funcionar corretamente
- ultimo retorno do usuario: "perfeito, agora funcionou"

## Arquivos principais deste ciclo

- `src/app/api/cron/verificar-notificacoes-agendamento/route.ts`
- `src/app/api/gzappy/webhook/route.ts`
- `src/app/api/gzappy/enviar/route.ts`
- `src/lib/gzappyService.ts`
- `src/app/app/arena/agendamentos/agenda/page.tsx`
- `src/app/app/arena/agendamentos/agenda/confirmacoes/page.tsx`
- `src/app/app/arena/agendamentos/agenda-mobile/page.tsx`
- `src/app/api/agendamento/interacao/route.ts`
- `src/services/agendamentoService.ts`
- `src/types/agendamento.ts`
- `vercel.json`

## Commits relevantes mencionados neste ciclo

- `07450a7`
- `fd3e927`
- `154daa7`
- `0bd5fb0`
- `4eae54f`
- `846bd4a`
- `50dc3c0`
- `50056ad` - ajusta cron e cria tela de confirmacoes
- `ec643b7` - melhora vinculo de respostas do webhook
- `51cf65a` - reforca logs e parsing do cron

## Como retomar em um novo chat

Se abrir um novo chat, pedir para o assistente:

1. ler este arquivo
2. considerar este resumo como contexto atual do projeto
3. continuar a partir do estado "cron funcionando em producao"

## Ultimo estado funcional

- cron funcionando em producao
- tela de confirmacoes criada e separada da agenda principal
- webhook ajustado para respostas com `@lid`
- regra `<= 12h` aplicada ao cron
- bloqueio de reenvio implementado
- ciclo atual encerrado pelo usuario
