# 🌐 Configuração para Consumo Externo da API

Este documento explica como configurar a API para ser consumida por frontends parceiros externos.

## 📋 Situação Atual

A API está estruturada em **Next.js API Routes** e atualmente funciona apenas para requisições do mesmo domínio. Para permitir consumo por outros frontends, é necessário configurar **CORS** (Cross-Origin Resource Sharing).

## ✅ Garantia: Frontend Atual Não Será Afetado

**IMPORTANTE**: A implementação de CORS foi feita de forma que **não afeta o funcionamento atual** do seu frontend no mesmo domínio:

- ✅ **Requisições do mesmo domínio** (sem header `Origin`) **não recebem headers CORS** - funcionam normalmente
- ✅ **Apenas requisições cross-origin** (com header `Origin` diferente) recebem headers CORS
- ✅ **Zero impacto** no desempenho ou comportamento das requisições internas
- ✅ **Compatibilidade total** mantida com o código existente

## ✅ O Que Já Está Pronto

- ✅ **Autenticação**: Suporta JWT (Bearer Token) e Basic Auth
- ✅ **Estrutura de API**: Todas as rotas em `/api/*`
- ✅ **Middleware CORS**: Criado em `src/lib/cors.ts` e `src/middleware.ts`

## 🔧 Configuração Necessária

### 1. Variável de Ambiente

Adicione a variável `ALLOWED_ORIGINS` no seu arquivo `.env.local` (desenvolvimento) ou nas configurações do Vercel (produção):

```bash
# .env.local
ALLOWED_ORIGINS=https://parceiro1.com,https://parceiro2.com,https://app-parceiro.vercel.app
```

**Importante:**
- Separe múltiplos domínios por vírgula
- Use URLs completas com protocolo (`https://`)
- Em desenvolvimento, localhost já está permitido automaticamente
- Para permitir qualquer origem (não recomendado em produção), use `*`

### 2. Aplicar CORS nas Rotas

Para cada rota da API que deve ser acessível externamente, você precisa:

1. **Importar a função `withCors`**:
```typescript
import { withCors } from '@/lib/cors';
```

2. **Aplicar nas respostas**:
```typescript
export async function GET(request: NextRequest) {
  // ... sua lógica ...
  
  const response = NextResponse.json(data);
  return withCors(response, request);
}
```

### 3. Exemplo Completo

```typescript
// src/app/api/exemplo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withCors } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  // Preflight já é tratado pelo middleware, mas pode adicionar aqui também
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    // Sua lógica aqui
    const data = { mensagem: 'Hello World' };
    
    const response = NextResponse.json(data);
    return withCors(response, request);
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { mensagem: 'Erro ao processar requisição' },
      { status: 500 }
    );
    return withCors(errorResponse, request);
  }
}
```

## 📝 Rotas que Precisam de CORS

Para permitir consumo externo, você deve aplicar CORS nas seguintes rotas:

### Rotas Públicas (sem autenticação):
- ✅ `/api/auth/login` - Já configurado como exemplo
- ✅ `/api/auth/register`
- ✅ `/api/point` (GET) - Listar arenas públicas

### Rotas Protegidas (com autenticação):
- `/api/atleta/*`
- `/api/agendamento/*`
- `/api/partida/*`
- `/api/user/*`
- `/api/quadra/*`
- `/api/tabela-preco/*`

## 🔐 Autenticação para Frontends Externos

### Método 1: JWT Token (Recomendado)

1. **Login**:
```javascript
const response = await fetch('https://seu-app.vercel.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'senha123' })
});

const { token, usuario } = await response.json();
```

2. **Usar Token em Requisições**:
```javascript
const response = await fetch('https://seu-app.vercel.app/api/atleta/listarAtletas', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Método 2: Basic Auth

```javascript
const email = 'user@example.com';
const senha = 'senha123';
const credentials = btoa(`${email}:${senha}`);

const response = await fetch('https://seu-app.vercel.app/api/atleta/listarAtletas', {
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  }
});
```

## 🚀 Próximos Passos

1. **Configurar variável de ambiente** `ALLOWED_ORIGINS` no Vercel
2. **Aplicar `withCors()`** nas rotas que devem ser acessíveis externamente
3. **Testar** com um frontend externo usando Postman ou curl
4. **Documentar** os endpoints disponíveis para parceiros

## 🧪 Testando CORS

### Com curl:
```bash
curl -X OPTIONS https://seu-app.vercel.app/api/auth/login \
  -H "Origin: https://parceiro.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

### Com JavaScript (no frontend parceiro):
```javascript
fetch('https://seu-app.vercel.app/api/point', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error('Erro:', err));
```

## ⚠️ Considerações de Segurança

1. **Não use `*` em produção** - Permita apenas domínios específicos
2. **Valide sempre a autenticação** - Mesmo com CORS, proteja rotas sensíveis
3. **Use HTTPS** - Sempre em produção
4. **Rate Limiting** - Considere implementar limite de requisições por IP/origem
5. **Logs** - Monitore requisições externas para detectar abusos

## 📚 Documentação da API

Consulte `TESTE_POSTMAN.md` para ver exemplos de uso de todos os endpoints disponíveis.

