import { createHmac } from 'crypto';
import { isValidMercadoPagoSignature } from './mercado-pago.signature';

function sign(secret: string, dataId: string, requestId: string, ts: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

describe('isValidMercadoPagoSignature', () => {
  const secret = 'clave-secreta';

  it('acepta una firma correcta', () => {
    const v1 = sign(secret, '123456', 'req-1', '1704908010');

    expect(
      isValidMercadoPagoSignature({
        secret,
        signatureHeader: `ts=1704908010,v1=${v1}`,
        requestId: 'req-1',
        dataId: '123456',
      }),
    ).toBe(true);
  });

  it('pasa a minúsculas los ids alfanuméricos, como hace Mercado Pago', () => {
    const v1 = sign(secret, 'abc123', 'req-1', '1');
    expect(
      isValidMercadoPagoSignature({
        secret,
        signatureHeader: `ts=1,v1=${v1}`,
        requestId: 'req-1',
        dataId: 'ABC123',
      }),
    ).toBe(true);
  });

  it('rechaza firmas alteradas o incompletas', () => {
    const v1 = sign(secret, '123456', 'req-1', '1704908010');

    expect(
      isValidMercadoPagoSignature({
        secret,
        signatureHeader: `ts=1704908010,v1=${v1}`,
        requestId: 'req-1',
        dataId: '999',
      }),
    ).toBe(false);
    expect(
      isValidMercadoPagoSignature({
        secret: 'otra',
        signatureHeader: `ts=1704908010,v1=${v1}`,
        requestId: 'req-1',
        dataId: '123456',
      }),
    ).toBe(false);
    expect(
      isValidMercadoPagoSignature({
        secret,
        signatureHeader: 'ts=1',
        dataId: '123456',
      }),
    ).toBe(false);
    expect(
      isValidMercadoPagoSignature({
        secret,
        signatureHeader: undefined,
        dataId: '123456',
      }),
    ).toBe(false);
  });
});
