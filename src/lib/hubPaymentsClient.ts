export type HubProjectName =
  | 'PLAY_NA_QUADRA'
  | 'MONSTRINHOS_BEACH'
  | 'GESTAO_TORNEIOS'
  | 'PROFESSOR_BT';

export type HubPaymentMethod = 'PIX' | 'CREDIT_CARD';

export interface HubCreatePaymentRequest {
  project_name: HubProjectName;
  order_id: string;
  amount: number;
  customer_email: string;
  customer_name?: string;
  customer_tax_id?: string;
  payment_method: HubPaymentMethod;
  card_encrypted?: string;
  pagbank_token?: string;
  metadata?: Record<string, unknown>;
}

export interface HubCreatePaymentLegacyRequest {
  cardId: string;
  valor: number;
  paymentMethod: HubPaymentMethod;
  cpf: string;
  descricao?: string | null;
  card_encrypted?: string;
  pagbank_token?: string;
}

export interface HubCreatePaymentResponse {
  transaction_id: string;
  pagbank_order_id?: string;
  status: string;
  qr_code?: {
    text?: string;
    links?: Array<{ rel: string; href: string }>;
  };
  links?: Array<{ rel: string; href: string }>;
}

export interface HubGetStatusResponse {
  transaction_id: string;
  pagbank_order_id?: string | null;
  status: string;
  pagbank_status?: string | null;
  source?: 'PAGBANK' | 'DB';
}

export interface HubPublicKeyResponse {
  public_key: string;
  created_at?: number | null;
}

function maskEmail(email: string) {
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

function maskTaxId(taxId: string) {
  const digits = taxId.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `***${digits.slice(-4)}`;
}

function sanitizeCreatePayload(payload: HubCreatePaymentRequest) {
  return {
    ...payload,
    customer_email: maskEmail(payload.customer_email),
    customer_tax_id: payload.customer_tax_id ? maskTaxId(payload.customer_tax_id) : undefined,
    card_encrypted: payload.card_encrypted ? '[REDACTED]' : undefined,
    pagbank_token: payload.pagbank_token ? '[REDACTED]' : undefined,
  };
}

function sanitizeCreateLegacyPayload(payload: HubCreatePaymentLegacyRequest) {
  return {
    ...payload,
    cpf: payload.cpf ? maskTaxId(payload.cpf) : undefined,
    card_encrypted: payload.card_encrypted ? '[REDACTED]' : undefined,
    pagbank_token: payload.pagbank_token ? '[REDACTED]' : undefined,
  };
}

function getHubConfig() {
  const baseUrlRaw = process.env.HUB_PAYMENTS_BASE_URL || '';
  const apiKey = process.env.HUB_PAYMENTS_API_KEY || '';
  const debug = process.env.HUB_PAYMENTS_DEBUG === 'true';

  let baseUrl = baseUrlRaw.trim().replace(/\/+$/, '');
  if (baseUrl.toLowerCase().endsWith('/api')) {
    baseUrl = baseUrl.slice(0, -4);
  }
  if (!baseUrl) {
    if (debug) {
      console.error('[HubPayments] HUB_PAYMENTS_BASE_URL ausente', {
        baseUrlRawLength: baseUrlRaw.length,
      });
    }
    throw new Error('HUB_PAYMENTS_BASE_URL não configurada');
  }
  if (!apiKey) {
    if (debug) {
      console.error('[HubPayments] HUB_PAYMENTS_API_KEY ausente');
    }
    throw new Error('HUB_PAYMENTS_API_KEY não configurada');
  }

  if (debug) {
    console.log('[HubPayments] Config', {
      baseUrl,
      baseUrlRaw,
      apiKeyConfigured: apiKey.length > 0,
      apiKeyLength: apiKey.length,
    });
  }

  return { baseUrl, apiKey };
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function hubCreatePayment(payload: HubCreatePaymentRequest): Promise<HubCreatePaymentResponse> {
  const { baseUrl, apiKey } = getHubConfig();
  const debug = process.env.HUB_PAYMENTS_DEBUG === 'true';
  const url = `${baseUrl}/api/payments/create`;
  const pagbankToken = payload.pagbank_token || null;
  const bodyPayload = { ...payload };
  delete (bodyPayload as any).pagbank_token;

  if (debug) {
    console.log('[HubPayments] Request', {
      url,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey ? '[REDACTED]' : '[MISSING]',
        'x-pagbank-token': pagbankToken ? '[REDACTED]' : undefined,
      },
      payload: sanitizeCreatePayload(payload),
    });
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        ...(pagbankToken ? { 'x-pagbank-token': pagbankToken } : {}),
      },
      body: JSON.stringify(bodyPayload),
    },
    20_000
  );

  const text = await res.text();
  if (debug) {
    console.log('[HubPayments] Response', {
      status: res.status,
      ok: res.ok,
      bodyPreview: text?.slice(0, 800) || '',
    });
  }
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && (json.mensagem || json.message || json.error)) ||
      `Erro no Hub de Pagamentos (HTTP ${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : `Erro no Hub de Pagamentos (HTTP ${res.status})`);
  }

  return json as HubCreatePaymentResponse;
}

export async function hubCreatePaymentLegacy(
  payload: HubCreatePaymentLegacyRequest
): Promise<HubCreatePaymentResponse> {
  const { baseUrl, apiKey } = getHubConfig();
  const debug = process.env.HUB_PAYMENTS_DEBUG === 'true';
  const url = `${baseUrl}/api/payments/create`;

  const pagbankToken = payload.pagbank_token || null;

  if (debug) {
    console.log('[HubPayments] Request', {
      url,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey ? '[REDACTED]' : '[MISSING]',
        'x-pagbank-token': pagbankToken ? '[REDACTED]' : undefined,
      },
      payload: sanitizeCreateLegacyPayload(payload),
    });
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        ...(pagbankToken ? { 'x-pagbank-token': pagbankToken } : {}),
      },
      body: JSON.stringify(payload),
    },
    20_000
  );

  const text = await res.text();
  if (debug) {
    console.log('[HubPayments] Response', {
      status: res.status,
      ok: res.ok,
      bodyPreview: text?.slice(0, 800) || '',
    });
  }
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const bodyPreview = text?.slice(0, 800) || '';
    const msg =
      (json && (json.mensagem || json.message || json.error)) ||
      `Erro no Hub de Pagamentos (HTTP ${res.status})`;
    const msgStr = typeof msg === 'string' ? msg : `Erro no Hub de Pagamentos (HTTP ${res.status})`;
    throw new Error(`${msgStr}${bodyPreview ? ` | body: ${bodyPreview}` : ''}`);
  }

  return json as HubCreatePaymentResponse;
}

export async function hubGetPaymentStatus(
  transactionId: string,
  options?: { pagbankToken?: string | null }
): Promise<HubGetStatusResponse> {
  const { baseUrl, apiKey } = getHubConfig();
  const debug = process.env.HUB_PAYMENTS_DEBUG === 'true';
  const url = `${baseUrl}/api/payments/status?transaction_id=${encodeURIComponent(transactionId)}`;

  if (debug) {
    console.log('[HubPayments] Request', {
      url,
      headers: {
        'x-api-key': apiKey ? '[REDACTED]' : '[MISSING]',
        'x-pagbank-token': options?.pagbankToken ? '[REDACTED]' : undefined,
      },
    });
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        ...(options?.pagbankToken ? { 'x-pagbank-token': options.pagbankToken } : {}),
      },
    },
    15_000
  );

  const text = await res.text();
  if (debug) {
    console.log('[HubPayments] Response', {
      status: res.status,
      ok: res.ok,
      bodyPreview: text?.slice(0, 800) || '',
    });
  }

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && (json.mensagem || json.message || json.error)) ||
      `Erro no Hub de Pagamentos (HTTP ${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : `Erro no Hub de Pagamentos (HTTP ${res.status})`);
  }

  return json as HubGetStatusResponse;
}

export async function hubGetPublicKey(options?: {
  pagbankToken?: string | null;
}): Promise<HubPublicKeyResponse> {
  const { baseUrl, apiKey } = getHubConfig();
  const debug = process.env.HUB_PAYMENTS_DEBUG === 'true';
  const url = `${baseUrl}/api/payments/public-key`;

  if (debug) {
    console.log('[HubPayments] Request', {
      url,
      headers: {
        'x-api-key': apiKey ? '[REDACTED]' : '[MISSING]',
        'x-pagbank-token': options?.pagbankToken ? '[REDACTED]' : undefined,
      },
    });
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        ...(options?.pagbankToken ? { 'x-pagbank-token': options.pagbankToken } : {}),
      },
    },
    15_000
  );

  const text = await res.text();
  if (debug) {
    console.log('[HubPayments] Response', {
      status: res.status,
      ok: res.ok,
      bodyPreview: text?.slice(0, 800) || '',
    });
  }

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && (json.mensagem || json.message || json.error)) ||
      `Erro no Hub de Pagamentos (HTTP ${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : `Erro no Hub de Pagamentos (HTTP ${res.status})`);
  }

  if (!json?.public_key || typeof json.public_key !== 'string') {
    throw new Error('Chave pública inválida retornada pelo hub');
  }

  return json as HubPublicKeyResponse;
}
