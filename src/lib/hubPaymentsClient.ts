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
  metadata?: Record<string, unknown>;
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

function getHubConfig() {
  const baseUrlRaw = process.env.HUB_PAYMENTS_BASE_URL || '';
  const apiKey = process.env.HUB_PAYMENTS_API_KEY || '';

  const baseUrl = baseUrlRaw.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('HUB_PAYMENTS_BASE_URL não configurada');
  }
  if (!apiKey) {
    throw new Error('HUB_PAYMENTS_API_KEY não configurada');
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

  const res = await fetchWithTimeout(
    `${baseUrl}/api/payments/create`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    },
    20_000
  );

  const text = await res.text();
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

