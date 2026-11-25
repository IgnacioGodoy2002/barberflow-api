import { toLocalDateString, toLocalTimeString } from '../common/timezone';

const SHOP = 'Nacho Barbershop';

/** Evita que un nombre con HTML rompa (o inyecte algo en) el email. */
function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(
  title: string,
  body: string,
  ctaUrl?: string,
  ctaLabel?: string,
) {
  const button = ctaUrl
    ? `<p style="margin:28px 0"><a href="${ctaUrl}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${ctaLabel}</a></p>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#09090b;font-family:Arial,sans-serif;color:#e4e4e7">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#a78bfa">${SHOP}</p>
    <h1 style="font-size:24px;color:#fff;margin:8px 0 20px">${title}</h1>
    ${body}
    ${button}
    <p style="font-size:12px;color:#71717a;margin-top:32px">Mensaje automático de BarberFlow.</p>
  </div></body></html>`;
}

function formatLongDate(date: Date) {
  const [y, m, d] = toLocalDateString(date).split('-');
  return `${d}/${m}/${y}`;
}

export function reminderEmail(params: {
  clientName: string;
  serviceName: string;
  barberName: string;
  startAt: Date;
  webUrl: string;
}) {
  return {
    subject: `Recordatorio: tu turno es mañana a las ${toLocalTimeString(params.startAt)}`,
    html: layout(
      `¡Hola ${esc(params.clientName.split(' ')[0])}! Te esperamos mañana`,
      `<p style="line-height:1.6">Te recordamos tu turno:</p>
       <ul style="line-height:1.8">
         <li><b>Servicio:</b> ${esc(params.serviceName)}</li>
         <li><b>Barbero:</b> ${esc(params.barberName)}</li>
         <li><b>Día:</b> ${formatLongDate(params.startAt)}</li>
         <li><b>Hora:</b> ${toLocalTimeString(params.startAt)}</li>
       </ul>
       <p style="line-height:1.6">Si no podés venir, reprogramalo o cancelalo desde "Mis turnos" así el horario le queda a otra persona.</p>`,
      `${params.webUrl}#reservar`,
      'Ver mis turnos',
    ),
  };
}

export function slotFreedEmail(params: {
  clientName: string;
  serviceName: string;
  date: string;
  webUrl: string;
}) {
  const [y, m, d] = params.date.split('-');
  return {
    subject: `Se liberó un turno el ${d}/${m}`,
    html: layout(
      `¡${esc(params.clientName.split(' ')[0])}, se liberó un horario!`,
      `<p style="line-height:1.6">Estabas en la lista de espera para <b>${esc(params.serviceName)}</b> el <b>${d}/${m}/${y}</b>. Alguien canceló y ahora hay lugar.</p>
       <p style="line-height:1.6">Los turnos se reservan por orden de llegada: si te sirve, entrá ahora.</p>`,
      `${params.webUrl}#reservar`,
      'Reservar ahora',
    ),
  };
}
