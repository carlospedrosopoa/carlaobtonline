# Requisição Postman - Listar Agendamentos (Agenda Semanal)

## Configuração da Requisição

### Método e URL
```
GET {{baseUrl}}/api/agendamento
```

**Nota:** `{{baseUrl}}` deve ser substituído pela URL base da sua aplicação:
- **Local:** `http://localhost:3000`
- **Produção:** `https://seu-dominio.com` (ou a URL do Vercel)

### Headers
```
Content-Type: application/json
Authorization: Bearer {seu_token_jwt}
```

**Alternativa (Basic Auth):**
```
Content-Type: application/json
Authorization: Basic {base64(email:senha)}
```

### Query Parameters (Parâmetros de URL)

| Parâmetro | Tipo | Obrigatório | Descrição | Exemplo |
|-----------|------|-------------|-----------|---------|
| `dataInicio` | string (ISO UTC) | Não | Data/hora inicial do período (formato ISO 8601 UTC) | `2024-01-15T00:00:00.000Z` |
| `dataFim` | string (ISO UTC) | Não | Data/hora final do período (formato ISO 8601 UTC) | `2024-01-19T23:59:59.999Z` |
| `status` | string | Não | Status do agendamento | `CONFIRMADO` |
| `quadraId` | string (UUID) | Não | ID da quadra específica | `123e4567-e89b-12d3-a456-426614174000` |
| `pointId` | string (UUID) | Não | ID da arena (point) | `123e4567-e89b-12d3-a456-426614174000` |
| `apenasMeus` | boolean | Não | Filtrar apenas agendamentos do usuário logado | `true` ou `false` |
| `incluirPassados` | boolean | Não | Incluir agendamentos passados (padrão: false) | `true` ou `false` |

### Exemplo Completo de URL

**Para agenda semanal (4 dias):**
```
GET {{baseUrl}}/api/agendamento?dataInicio=2024-01-15T00:00:00.000Z&dataFim=2024-01-19T23:59:59.999Z&status=CONFIRMADO
```

**Para uma semana específica (exemplo: 15 a 19 de janeiro de 2024):**
```
GET {{baseUrl}}/api/agendamento?dataInicio=2024-01-15T00:00:00.000Z&dataFim=2024-01-19T23:59:59.999Z&status=CONFIRMADO
```

**Para testar o agendamento das 6h:**
```
GET {{baseUrl}}/api/agendamento?dataInicio=2024-01-15T00:00:00.000Z&dataFim=2024-01-15T23:59:59.999Z&status=CONFIRMADO
```

## Exemplo de Resposta (200 OK)

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "quadraId": "quadra-uuid",
    "usuarioId": "usuario-uuid",
    "atletaId": "atleta-uuid",
    "nomeAvulso": null,
    "telefoneAvulso": null,
    "dataHora": "2024-01-15T06:00:00.000Z",
    "duracao": 90,
    "valorHora": 50.00,
    "valorCalculado": 75.00,
    "valorNegociado": null,
    "status": "CONFIRMADO",
    "observacoes": "Observação do agendamento",
    "recorrenciaId": null,
    "recorrenciaConfig": null,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-10T10:00:00.000Z",
    "quadra": {
      "id": "quadra-uuid",
      "nome": "Quadra 1",
      "pointId": "point-uuid",
      "point": {
        "id": "point-uuid",
        "nome": "Arena Exemplo",
        "logoUrl": "https://..."
      }
    },
    "usuario": {
      "id": "usuario-uuid",
      "name": "Nome do Usuário",
      "email": "usuario@example.com"
    },
    "atleta": {
      "id": "atleta-uuid",
      "nome": "Nome do Atleta",
      "fone": "51999999999"
    },
    "atletasParticipantes": []
  }
]
```

## Como Obter o Token JWT

1. **Fazer login na aplicação:**
   ```
   POST {{baseUrl}}/api/user/auth/login
   Body: {
     "email": "seu-email@example.com",
     "senha": "sua-senha"
   }
   ```

2. **Copiar o token da resposta:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "usuario": { ... }
   }
   ```

3. **Usar no header Authorization:**
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Código JavaScript para Gerar Datas (Exemplo)

```javascript
// Para gerar dataInicio e dataFim para a agenda semanal
const hoje = new Date();
const ano = hoje.getFullYear();
const mes = hoje.getMonth();
const dia = hoje.getDate();

// Data início: meia-noite do dia atual em UTC
const dataInicio = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));

// Data fim: 4 dias depois, 23:59:59 em UTC
const dataFim = new Date(Date.UTC(ano, mes, dia, 23, 59, 59, 999));
dataFim.setUTCDate(dataFim.getUTCDate() + 4);

// Converter para ISO string
const dataInicioISO = dataInicio.toISOString(); // Ex: "2024-01-15T00:00:00.000Z"
const dataFimISO = dataFim.toISOString(); // Ex: "2024-01-19T23:59:59.999Z"
```

## Possíveis Erros

### 401 Unauthorized
```json
{
  "mensagem": "Não autenticado"
}
```
**Solução:** Verificar se o token JWT está válido e presente no header Authorization.

### 500 Internal Server Error
```json
{
  "mensagem": "Erro ao listar agendamentos",
  "error": "Detalhes do erro"
}
```
**Solução:** Verificar logs do servidor para mais detalhes.

## Notas Importantes

1. **Timezone:** As datas devem ser enviadas em formato UTC (ISO 8601 com 'Z' no final).
2. **Status:** O status padrão usado na agenda semanal é `CONFIRMADO`.
3. **Ordenação:** Os agendamentos são retornados ordenados por `dataHora` (ASC).
4. **Permissões:** 
   - **ADMIN:** Vê todos os agendamentos
   - **ORGANIZER:** Vê apenas agendamentos das quadras da sua arena
   - **USER:** Vê apenas seus próprios agendamentos (ou do seu atleta)

