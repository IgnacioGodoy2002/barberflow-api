// Los tests corren con la misma zona horaria que producción.
process.env.TZ = 'America/Argentina/Buenos_Aires';
process.env.NODE_ENV = 'test';
// Mercado Pago se simula en los tests (nunca se llama a la API real).
process.env.MP_API_BASE = 'https://mp.test';
