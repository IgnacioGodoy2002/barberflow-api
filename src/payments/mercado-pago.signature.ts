import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifica la firma `x-signature` que Mercado Pago manda en cada webhook.
 * Formato del header: "ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839"
 * Plantilla firmada: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export function isValidMercadoPagoSignature(params: {
  secret: string;
  signatureHeader?: string;
  requestId?: string;
  dataId?: string;
}) {
  const { secret, signatureHeader, requestId, dataId } = params;
  if (!signatureHeader || !dataId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key.trim(), rest.join('=').trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Si el id es alfanumérico, MP lo firma en minúsculas.
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;

  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
