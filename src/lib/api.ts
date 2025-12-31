// lib/api.ts - Cliente de API para Next.js (compatível com axios-style)
// Suporta JWT (preferido) e Basic Auth (fallback)
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

let accessToken: string | null = null;
let basicCreds: { email: string; senha: string } | null = null;

// Função para definir o token JWT
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }
}

// Função para definir credenciais Basic Auth (mantida para compatibilidade)
export function setBasicCreds(creds: { email: string; senha: string } | null) {
  basicCreds = creds;
  if (typeof window !== 'undefined') {
    if (creds) {
      localStorage.setItem('basicCreds', JSON.stringify(creds));
    } else {
      localStorage.removeItem('basicCreds');
    }
  }
}

// Recupera tokens/credenciais do localStorage na inicialização
if (typeof window !== 'undefined') {
  const storedToken = localStorage.getItem('accessToken');
  if (storedToken) {
    accessToken = storedToken;
  }

  const storedCreds = localStorage.getItem('basicCreds');
  if (storedCreds) {
    try {
      basicCreds = JSON.parse(storedCreds);
    } catch {}
  }
}

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Prioridade 1: JWT Bearer Token (método preferido)
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (typeof window !== 'undefined') {
    // Tenta recuperar do localStorage se não estiver em memória
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      accessToken = storedToken;
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  // Prioridade 2: Basic Auth (fallback para compatibilidade)
  if (!headers['Authorization'] && basicCreds) {
    const b64 = btoa(`${basicCreds.email}:${basicCreds.senha}`);
    headers['Authorization'] = `Basic ${b64}`;
  } else if (!headers['Authorization'] && typeof window !== 'undefined') {
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
    headers: headers as HeadersInit,
  });

  // Se receber 401, pode ser token expirado - limpa o token
  if (response.status === 401 && accessToken) {
    setAccessToken(null);
  }

  return response;
}

// API estilo axios para compatibilidade
export const api = {
  get: async (endpoint: string, config?: any) => {
    try {
      // Se responseType é 'blob', não adiciona Content-Type JSON
      const headers: Record<string, string> = {
        ...(config?.headers as Record<string, string> || {}),
      };
      
      // Só adiciona Content-Type JSON se não for blob
      if (config?.responseType !== 'blob') {
        headers['Content-Type'] = 'application/json';
      }

      const response = await apiRequest(endpoint, {
        method: 'GET',
        headers,
      });
      
      // 204 No Content - não tem body
      if (response.status === 204) {
        return { data: null, status: 204, headers: response.headers };
      }
      
      // Se responseType é 'blob', retorna o blob
      if (config?.responseType === 'blob') {
        const blob = await response.blob();
        if (!response.ok) {
          const error: any = new Error('Erro ao obter blob');
          error.status = response.status;
          error.response = { data: blob };
          throw error;
        }
        return { data: blob, status: response.status, headers: response.headers };
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
        error.response = { data };
        error.data = data;
        throw error;
      }
      
      return { data, status: response.status, headers: response.headers };
    } catch (error: any) {
      console.error('API POST error:', error);
      // Se já tem status, relança o erro
      if (error.status || error.response) {
        throw error;
      }
      // Caso contrário, cria um erro genérico
      const apiError: any = new Error(error.message || 'Erro ao conectar com o servidor');
      apiError.status = 500;
      throw apiError;
    }
  },
  
  put: async (endpoint: string, body?: any, config?: any) => {
    try {
      const response = await apiRequest(endpoint, {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
        headers: config?.headers,
      });
      
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
        error.response = { data };
        error.data = data;
        throw error;
      }
      
      return { data, status: response.status, headers: response.headers };
    } catch (error: any) {
      console.error('API PUT error:', error);
      // Se já tem status, relança o erro
      if (error.status || error.response) {
        throw error;
      }
      // Caso contrário, cria um erro genérico
      const apiError: any = new Error(error.message || 'Erro ao conectar com o servidor');
      apiError.status = 500;
      throw apiError;
    }
  },
  
  delete: async (endpoint: string, config?: any) => {
    try {
      // Se config contém 'data', usa como body (padrão axios)
      // Caso contrário, se config existe e não é apenas headers, usa como body
      let body: any = undefined;
      let headers: any = undefined;
      
      if (config) {
        if (config.data !== undefined) {
          // Padrão axios: { data: {...}, headers: {...} }
          body = config.data;
          headers = config.headers;
        } else if (config.headers !== undefined && Object.keys(config).length === 1) {
          // Apenas headers, sem body
          headers = config.headers;
        } else {
          // Objeto simples como body (ex: { senha: '...' })
          const { headers: configHeaders, ...rest } = config;
          if (Object.keys(rest).length > 0) {
            body = rest;
          }
          headers = configHeaders;
        }
      }
      
      const response = await apiRequest(endpoint, {
        method: 'DELETE',
        body: body ? JSON.stringify(body) : undefined,
        headers: headers,
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
        error.response = { data };
        error.data = data;
        throw error;
      }
      
      return { data, status: response.status, headers: response.headers };
    } catch (error: any) {
      console.error('API DELETE error:', error);
      // Se já tem status, relança o erro
      if (error.status || error.response) {
        throw error;
      }
      // Caso contrário, cria um erro genérico
      const apiError: any = new Error(error.message || 'Erro ao conectar com o servidor');
      apiError.status = 500;
      throw apiError;
    }
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
  
  patch: (endpoint: string, data?: any, options?: RequestInit) => 
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: (endpoint: string, options?: RequestInit) => 
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
