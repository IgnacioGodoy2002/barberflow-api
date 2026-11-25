/**
 * Zona horaria del negocio. Los horarios laborales ("10:00"–"20:00") y las
 * fechas "YYYY-MM-DD" se interpretan en esta zona.
 *
 * Se fija al arrancar (main.ts) y en los tests, porque Render corre en UTC:
 * sin esto, un turno de las 18:00 de Argentina se evaluaba como 21:00.
 */
export const BUSINESS_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function applyBusinessTimezone() {
  process.env.TZ = BUSINESS_TIMEZONE;
}

/** Fecha local (YYYY-MM-DD) de un instante, en la zona del negocio. */
export function toLocalDateString(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE });
}

/** Hora local (HH:mm) de un instante, en la zona del negocio. */
export function toLocalTimeString(date: Date) {
  return date.toLocaleTimeString('es-AR', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
