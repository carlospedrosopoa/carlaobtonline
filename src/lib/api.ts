// lib/api.ts - Cliente de API para Next.js (compatível com axios-style)
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

let basicCreds: { email: string; senha: string } | null = null;

export function setBasicCreds(creds: { email: string; senha: string } | null) {
  basicCreds = creds;
  // Salva no localStorage também para persistir
  if (creds) {
    localStorage.setItem('basicCreds', JSON.stringify(creds));
  } else {
    localStorage.removeItem('basicCreds');
  }
}

// Recupera credenciais do localStorage na inicialização
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('basicCreds');
  if (stored) {
    try {
      basicCreds = JSON.parse(stored);
    } catch {}
  }
}

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Adiciona Basic Auth se disponível
  if (basicCreds) {
    const b64 = btoa(`${basicCreds.email}:${basicCreds.senha}`);
    headers['Authorization'] = `Basic ${b64}`;
  } else {
    // Tenta recuperar do localStorage se não estiver em memória
    const stored = localStorage.getItem('basicCreds');
    if (stored) {
      try {
        const creds = JSON.parse(stored);
        const b64 = btoa(`${creds.email}:${creds.senha}`);
        headers['Authorization'] = `Basic ${b64}`;
      } catch {}
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

// API estilo axios para compatibilidade
export const api = {
  get: async (endpoint: string, config?: any) => {
    try {
      const response = await apiRequest(endpoint, {
        method: 'GET',
        headers: config?.headers,
      });
      
      // 204 No Content - não tem body
      if (response.status === 204) {
        return { data: null, status: 204, headers: response.headers };
      }
      
      // Tenta parsear JSON, se falhar retorna objeto vazio
      const data = await response.json().catch(() => {
        // Se não conseguir parsear e o status não é 200, pode ser erro
        if (!response.ok) {
          return { mensagem: 'Erro ao processar resposta', status: response.status };
        }
        return {};
      });
      
      // Se a resposta não está ok, lança erro
      if (!response.ok) {
        const error: any = new Error(data.mensagem || data.error || 'Erro na requisição');
        error.status = response.status;
        error.data = data;
        throw error;
      }
      
      return { data, status: response.status, headers: response.headers };
    } catch (error: any) {
      console.error('API GET error:', error);
      // Se já tem status, relança o erro
      if (error.status) {
        throw error;
      }
      // Caso contrário, cria um erro genérico
      const apiError: any = new Error(error.message || 'Erro ao conectar com o servidor');
      apiError.status = 500;
      throw apiError;
    }
  },
  
  post: async (endpoint: string, body?: any, config?: any) => {
    try {
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        headers: config?.headers,
      });
      const data = await response.json().catch(() => ({}));
      return { data, status: response.status, headers: response.headers };
    } catch (error: any) {
      console.error('API POST error:', error);
      // Retorna um objeto com status de erro para compatibilidade
      return { 
        data: { mensagem: error.message || 'Erro ao conectar com o servidor' }, 
        status: 500, 
        headers: {} 
      };
    }
  },
  
  put: async (endpoint: string, body?: any, config?: any) => {
    const response = await apiRequest(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: config?.headers,
    });
    const data = await response.json().catch(() => ({}));
    return { data, status: response.status, headers: response.headers };
  },
  
  delete: async (endpoint: string, config?: any) => {
    const response = await apiRequest(endpoint, {
      method: 'DELETE',
      headers: config?.headers,
    });
    const data = await response.json().catch(() => ({}));
    return { data, status: response.status, headers: response.headers };
  },
  
  // Para upload de arquivos (FormData)
  postFormData: async (endpoint: string, formData: FormData) => {
    // Remove Content-Type para o browser definir automaticamente com boundary
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} as any, // Sem Content-Type para FormData
    });
    const data = await response.json().catch(() => ({}));
    return { data, status: response.status, headers: response.headers };
  },
};

// Helpers para métodos HTTP (compatibilidade)
export const apiClient = {
  get: (endpoint: string, options?: RequestInit) => 
    apiRequest(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint: string, data?: any, options?: RequestInit) => 
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  put: (endpoint: string, data?: any, options?: RequestInit) => 
    apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: (endpoint: string, options?: RequestInit) => 
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
