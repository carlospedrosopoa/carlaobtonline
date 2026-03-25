type PixPayloadInput = {
  pixKey: string;
  amount: number;
  merchantName?: string;
  merchantCity?: string;
  txid?: string;
  description?: string;
};

function onlyAscii(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function tlv(id: string, value: string) {
  const length = String(value.length).padStart(2, '0');
  return `${id}${length}${value}`;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaECola(input: PixPayloadInput) {
  const nome = onlyAscii(input.merchantName || 'PLAY NA QUADRA').slice(0, 25) || 'PLAY NA QUADRA';
  const cidade = onlyAscii(input.merchantCity || 'PORTO ALEGRE').slice(0, 15) || 'PORTO ALEGRE';
  const chave = input.pixKey.trim();
  const valor = Number(input.amount || 0);
  const txid = onlyAscii(input.txid || '***').slice(0, 25) || '***';

  let merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave);
  const descricao = onlyAscii(input.description || '').slice(0, 50);
  if (descricao) {
    merchantAccount += tlv('02', descricao);
  }

  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('26', merchantAccount);
  payload += tlv('52', '0000');
  payload += tlv('53', '986');
  if (valor > 0) {
    payload += tlv('54', valor.toFixed(2));
  }
  payload += tlv('58', 'BR');
  payload += tlv('59', nome);
  payload += tlv('60', cidade);
  payload += tlv('62', tlv('05', txid));

  const semCrc = `${payload}6304`;
  const crc = crc16Ccitt(semCrc);
  return `${semCrc}${crc}`;
}

export function gerarPixQrCodeUrl(copiaECola: string) {
  return `https://quickchart.io/qr?size=360&text=${encodeURIComponent(copiaECola)}`;
}
