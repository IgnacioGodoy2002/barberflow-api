import { resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('usa el secreto configurado', () => {
    expect(resolveJwtSecret('mi-secreto')).toBe('mi-secreto');
  });

  it('en desarrollo permite un valor por defecto', () => {
    process.env.NODE_ENV = 'development';
    expect(resolveJwtSecret(undefined)).toBeTruthy();
  });

  it('en producción exige JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveJwtSecret('')).toThrow('JWT_SECRET es obligatorio');
  });
});
