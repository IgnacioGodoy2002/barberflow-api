const DEV_FALLBACK_SECRET = 'barberflow_super_secret_dev';

/**
 * En producción el secreto es obligatorio: con el valor por defecto,
 * cualquiera que lea el código podría firmar tokens de ADMIN.
 */
export function resolveJwtSecret(value: string | undefined) {
  if (value && value.trim().length > 0) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción');
  }

  return DEV_FALLBACK_SECRET;
}
