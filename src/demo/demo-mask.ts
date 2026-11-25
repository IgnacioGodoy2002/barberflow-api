const HIDDEN_NOTE = '(nota oculta en el modo demo)';

function shortCode(id: unknown) {
  return typeof id === 'string'
    ? id.replace(/-/g, '').slice(0, 4).toUpperCase()
    : 'XXXX';
}

function maskEmail(email: string) {
  const [user] = email.split('@');
  return `${user.slice(0, 1) || '•'}•••@•••`;
}

/**
 * Oculta datos personales en las respuestas que recibe un usuario demo.
 * Recorre la respuesta completa (objetos y listas) y reemplaza:
 *  - email y teléfono de cualquier persona,
 *  - nombre real de los usuarios (los barberos siguen viéndose por su displayName),
 *  - notas y motivos de cancelación (pueden tener datos personales).
 */
export function maskForDemo<T>(value: T, demoUserId?: string): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => maskForDemo(item, demoUserId)) as T;
  }

  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  // Decimal de Prisma y similares: se serializan solos.
  if (
    typeof (value as { toJSON?: unknown }).toJSON === 'function' &&
    !(value.constructor === Object)
  ) {
    return value;
  }

  const source = value as Record<string, unknown>;
  const isSelf = demoUserId !== undefined && source.id === demoUserId;
  const looksLikeUser = typeof source.email === 'string';
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(source)) {
    if (isSelf) {
      result[key] = field;
    } else if (key === 'email' && typeof field === 'string') {
      result[key] = maskEmail(field);
    } else if (
      (key === 'phone' || key === 'clientPhone') &&
      typeof field === 'string' &&
      field
    ) {
      result[key] =
        `•••• ${field.replace(/\D/g, '').slice(-2).padStart(2, '•')}`;
    } else if (
      key === 'fullName' &&
      looksLikeUser &&
      typeof field === 'string'
    ) {
      result[key] = `Cliente ${shortCode(source.id)}`;
    } else if (
      (key === 'notes' || key === 'cancelReason') &&
      typeof field === 'string' &&
      field
    ) {
      result[key] = HIDDEN_NOTE;
    } else {
      result[key] = maskForDemo(field, demoUserId);
    }
  }

  return result as T;
}
