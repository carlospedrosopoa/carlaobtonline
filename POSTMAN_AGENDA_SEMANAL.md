# 📮 Postman - Consulta de Agenda Semanal

## 🔍 GET /api/agendamento - Listar Agendamentos com Filtros de Data

### Configuração Básica

**Método:** `GET`  
**URL:** `https://seu-app.vercel.app/api/agendamento`  
**Authorization:** 
- **JWT (Recomendado):** `Bearer <token>` (obtido no login)
- **Basic Auth (Fallback):** Basic Auth (email e senha)

---

## 📋 Exemplos de Requisições

### 1. Agenda Semanal (4 dias a partir de hoje)

**URL Completa:**
```
GET https://seu-app.vercel.app/api/agendamento?dataInicio=2024-01-15T00:00:00.000Z&dataFim=2024-01-19T23:59:59.999Z&status=CONFIRMADO
```

**Parâmetros de Query:**
- `dataInicio`: Data inicial em formato UTC ISO (ex: `2024-01-15T00:00:00.000Z`)
- `dataFim`: Data final em formato UTC ISO (ex: `2024-01-19T23:59:59.999Z`)
- `status`: `CONFIRMADO` (opcional)

**Headers:**
```
Authorization: Bearer <seu-token-jwt>
Content-Type: application/json
```

**Exemplo no Postman:**
1. Método: `GET`
2. URL: `https://seu-app.vercel.app/api/agendamento`
3. Params (Query Params):
   - `dataInicio`: `2024-01-15T00:00:00.000Z`
   - `dataFim`: `2024-01-19T23:59:59.999Z`
   - `status`: `CONFIRMADO`
4. Authorization → Type: `Bearer Token` → Token: `<seu-token>`

---

### 2. Agenda Semanal (Data Específica - Hoje)

**Para obter a data de hoje em UTC:**
```javascript
// No console do navegador ou Postman Pre-request Script:
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);
const dataFim = new Date(hoje);
dataFim.setDate(dataFim.getDate() + 4);
dataFim.setHours(23, 59, 59, 999);

console.log('dataInicio:', hoje.toISOString());
console.log('dataFim:', dataFim.toISOString());
```

**URL com datas dinâmicas:**
```
GET https://seu-app.vercel.app/api/agendamento?dataInicio={{dataInicio}}&dataFim={{dataFim}}&status=CONFIRMADO
```

---

### 3. Agenda com Filtro por Quadra

**URL:**
```
GET https://seu-app.vercel.app/api/agendamento?quadraId=<id-da-quadra>&dataInicio=2024-01-15T00:00:00.000Z&dataFim=2024-01-19T23:59:59.999Z&status=CONFIRMADO
```

**Parâmetros:**
- `quadraId`: ID da quadra específica
- `dataInicio`: Data inicial UTC
- `dataFim`: Data final UTC
- `status`: `CONFIRMADO`

---

### 4. Agenda com Filtro por Arena (Point)

**URL:**
```
GET https://seu-app.vercel.app/api/agendamento?pointId=<id-do-point>&dataInicio=2024-01-15T00:00:00.000Z&dataFim=2024-01-19T23:59:59.999Z&status=CONFIRMADO
```

**Parâmetros:**
- `pointId`: ID da arena/point
- `dataInicio`: Data inicial UTC
- `dataFim`: Data final UTC
- `status`: `CONFIRMADO`

---

### 5. Todos os Agendamentos (sem filtro de data)

**URL:**
```
GET https://seu-app.vercel.app/api/agendamento?status=CONFIRMADO
```

**Parâmetros:**
- `status`: `CONFIRMADO` (opcional)

---

## 🔐 Como Obter o Token JWT

### 1. Login via Postman

**Método:** `POST`  
**URL:** `https://seu-app.vercel.app/api/auth/login`

**Body (raw JSON):**
```json
{
  "email": "seu-email@exemplo.com",
  "password": "sua-senha"
}
```

**Resposta:**
```json
{
  "usuario": {
    "id": "uuid",
    "nome": "Nome",
    "email": "email@exemplo.com",
    "role": "ORGANIZER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

**Copie o `token` e use no header Authorization.**

---

## 📊 Resposta Esperada

**Status:** `200 OK`

**Body (JSON):**
```json
[
  {
    "id": "uuid",
    "quadraId": "uuid",
    "usuarioId": "uuid",
    "atletaId": "uuid",
    "nomeAvulso": null,
    "telefoneAvulso": null,
    "dataHora": "2024-01-15T14:00:00.000Z",
    "duracao": 60,
    "valorHora": 50.00,
    "valorCalculado": 50.00,
    "valorNegociado": null,
    "status": "CONFIRMADO",
    "observacoes": "Observação do agendamento",
    "quadra": {
      "id": "uuid",
      "nome": "Quadra 1",
      "pointId": "uuid"
    },
    "point": {
      "id": "uuid",
      "nome": "Arena Exemplo"
    },
    "usuario": {
      "id": "uuid",
      "name": "Nome do Usuário",
      "email": "email@exemplo.com"
    },
    "atleta": {
      "id": "uuid",
      "nome": "Nome do Atleta",
      "fone": "11999999999"
    }
  }
]
```

---

## 🧪 Script Pre-request para Postman (Gerar Datas Automaticamente)

Adicione este script na aba **Pre-request Script** do Postman:

```javascript
// Gerar data de hoje em UTC (00:00:00)
const hoje = new Date();
hoje.setUTCHours(0, 0, 0, 0);

// Gerar data fim (4 dias depois, 23:59:59)
const dataFim = new Date(hoje);
dataFim.setUTCDate(dataFim.getUTCDate() + 4);
dataFim.setUTCHours(23, 59, 59, 999);

// Definir variáveis de ambiente
pm.environment.set("dataInicio", hoje.toISOString());
pm.environment.set("dataFim", dataFim.toISOString());

console.log("Data Início:", hoje.toISOString());
console.log("Data Fim:", dataFim.toISOString());
```

Depois use nas URLs:
```
GET https://seu-app.vercel.app/api/agendamento?dataInicio={{dataInicio}}&dataFim={{dataFim}}&status=CONFIRMADO
```

---

## 🔍 Verificações de Debug

### 1. Verificar se as datas estão corretas

Adicione um console.log na resposta:
```javascript
// Na aba Tests do Postman:
pm.test("Verificar datas", function () {
    const response = pm.response.json();
    console.log("Total de agendamentos:", response.length);
    
    if (response.length > 0) {
        response.forEach((ag, index) => {
            console.log(`Agendamento ${index + 1}:`, {
                dataHora: ag.dataHora,
                quadra: ag.quadra?.nome,
                status: ag.status
            });
        });
    }
});
```

### 2. Verificar filtros aplicados

```javascript
// Na aba Tests:
pm.test("Verificar filtros", function () {
    const url = pm.request.url.toString();
    console.log("URL completa:", url);
    console.log("Query params:", pm.request.url.query.toObject());
});
```

---

## ⚠️ Problemas Comuns

### 1. Agendamentos não aparecem

**Verifique:**
- ✅ Token JWT válido e não expirado
- ✅ Datas em formato UTC ISO (`2024-01-15T00:00:00.000Z`)
- ✅ Status do agendamento (`CONFIRMADO`)
- ✅ Permissões do usuário (ORGANIZER vê apenas sua arena)

### 2. Erro 401 (Não autorizado)

**Solução:**
- Faça login novamente para obter novo token
- Verifique se o token está no header `Authorization: Bearer <token>`

### 3. Datas incorretas

**Solução:**
- Use sempre formato UTC ISO: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Use o script Pre-request para gerar datas automaticamente

---

## 📝 Exemplo Completo de Collection Postman

```json
{
  "info": {
    "name": "Agenda Semanal",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"seu-email@exemplo.com\",\n  \"password\": \"sua-senha\"\n}"
        },
        "url": {
          "raw": "https://seu-app.vercel.app/api/auth/login",
          "protocol": "https",
          "host": ["seu-app", "vercel", "app"],
          "path": ["api", "auth", "login"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "const response = pm.response.json();",
              "if (response.token) {",
              "  pm.environment.set('jwt_token', response.token);",
              "}"
            ]
          }
        }
      ]
    },
    {
      "name": "Listar Agendamentos - Agenda Semanal",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{jwt_token}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "https://seu-app.vercel.app/api/agendamento?dataInicio={{dataInicio}}&dataFim={{dataFim}}&status=CONFIRMADO",
          "protocol": "https",
          "host": ["seu-app", "vercel", "app"],
          "path": ["api", "agendamento"],
          "query": [
            {"key": "dataInicio", "value": "{{dataInicio}}"},
            {"key": "dataFim", "value": "{{dataFim}}"},
            {"key": "status", "value": "CONFIRMADO"}
          ]
        }
      },
      "event": [
        {
          "listen": "prerequest",
          "script": {
            "exec": [
              "const hoje = new Date();",
              "hoje.setUTCHours(0, 0, 0, 0);",
              "const dataFim = new Date(hoje);",
              "dataFim.setUTCDate(dataFim.getUTCDate() + 4);",
              "dataFim.setUTCHours(23, 59, 59, 999);",
              "pm.environment.set('dataInicio', hoje.toISOString());",
              "pm.environment.set('dataFim', dataFim.toISOString());"
            ]
          }
        }
      ]
    }
  ]
}
```

---

## 🚀 Teste Rápido

1. **Faça login** e copie o token
2. **Crie uma requisição GET** para `/api/agendamento`
3. **Adicione query params:**
   - `dataInicio`: `2024-01-15T00:00:00.000Z` (ajuste para hoje)
   - `dataFim`: `2024-01-19T23:59:59.999Z` (4 dias depois)
   - `status`: `CONFIRMADO`
4. **Adicione header:** `Authorization: Bearer <token>`
5. **Envie a requisição** e verifique a resposta

---

**Nota:** Substitua `https://seu-app.vercel.app` pela URL real do seu app no Vercel.

