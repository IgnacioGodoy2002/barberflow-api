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

/** Offset de la zona del negocio para un día dado, p. ej. "-03:00". */
export function businessOffset(date: string) {
  const reference = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(reference);
  const name =
    parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = name.replace('GMT', '');
  return offset === '' ? 'Z' : offset;
}

/**
 * Instante de un día y hora locales del negocio ("2026-12-02", "10:00"),
 * sin depender de la zona horaria del servidor.
 */
export function businessDateTime(date: string, time: string) {
  return new Date(
    `${date}T${time.length === 5 ? `${time}:00` : time}${businessOffset(date)}`,
  );
}

/** Día de la semana (0 = domingo) de una fecha "YYYY-MM-DD". */
export function dayOfWeekOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
