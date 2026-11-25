# BarberFlow API

[![CI](https://github.com/IgnacioGodoy2002/barberflow-api/actions/workflows/ci.yml/badge.svg)](https://github.com/IgnacioGodoy2002/barberflow-api/actions/workflows/ci.yml)

API REST de **BarberFlow**, el sistema de turnos online de Nacho Barbershop. Maneja clientes, barberos, servicios, horarios, disponibilidad, reservas con seña (Mercado Pago), reprogramación, lista de espera y recordatorios por email.

- **API:** https://barberflow-api-9feo.onrender.com
- **Swagger:** https://barberflow-api-9feo.onrender.com/api/docs
- **Web:** https://barberflow-web-six.vercel.app · [panel admin en modo demo](https://barberflow-web-six.vercel.app/admin?demo=1)
- **Frontend:** https://github.com/IgnacioGodoy2002/barberflow-web

## Funcionalidades

| Área | Qué hace |
| --- | --- |
| Autenticación | Registro e inicio de sesión con JWT. Roles `ADMIN`, `BARBER` y `CLIENT`. |
| Agenda | Servicios con duración y margen entre turnos, barberos, horarios laborales y bloqueos (vacaciones, descansos). |
| Disponibilidad | Calcula los horarios libres por barbero, servicio y día, en hora de Argentina. |
| Reservas | Sin doble reserva aunque lleguen pedidos simultáneos. Turnos manuales desde el panel. |
| Seña | Checkout Pro de Mercado Pago. El turno se confirma cuando el webhook (firmado) avisa el pago y, si no se paga a tiempo, se libera solo. |
| Reprogramar | El cliente mueve su turno (hasta 2 veces y con 2 h de anticipación). |
| Lista de espera | Si no hay lugar, el cliente se anota y recibe un email cuando alguien cancela o reprograma. |
| Recordatorios | Email automático entre 20 y 26 horas antes del turno. |
| Modo demo | `POST /v1/auth/demo` da acceso de solo lectura al panel, con los datos de los clientes ocultos. |
| Métricas | `GET /v1/stats/public`: turnos gestionados y clientes (sin datos personales). |

## Decisiones técnicas

**Doble reserva imposible.** Antes, dos clientes podían pasar la validación "¿está libre?" al mismo tiempo y los dos quedaban reservados. Ahora cada reserva corre en una transacción que toma un lock de Postgres por barbero (`pg_advisory_xact_lock`): la segunda espera, valida de nuevo y ve el turno ocupado. Un test de punta a punta dispara 8 reservas simultáneas y verifica que se confirma solo 1.

**Zona horaria explícita.** Render corre en UTC. Los horarios laborales (`"10:00"`–`"20:00"`) se evalúan siempre en `America/Argentina/Buenos_Aires`, si no un turno de las 18:00 se interpretaba como 21:00.

**Webhooks seguros.** El webhook de Mercado Pago verifica la firma `x-signature` (HMAC-SHA256) y después consulta el pago a la API de Mercado Pago: nunca confía en el body que llega.

**Modo demo sin riesgos.** Un interceptor global (`DemoInterceptor`) bloquea cualquier escritura de un usuario demo (403) y enmascara nombres, emails, teléfonos y notas de los clientes en todas las respuestas.

**Seguridad.** El registro público siempre crea clientes (antes aceptaba `role: "ADMIN"`), la cuenta demo no puede entrar con contraseña y `JWT_SECRET` es obligatorio en producción.

**Tareas programadas.** Recordatorios y vencimiento de señas corren con `@nestjs/schedule` y también se pueden disparar con `POST /v1/jobs/run` (protegido con `CRON_SECRET`). Un workflow de GitHub Actions llama a ese endpoint cada 10 minutos, lo que además mantiene despierto el servidor gratuito de Render.

## Tecnologías

NestJS 11 · TypeScript · PostgreSQL · Prisma 7 · JWT / Passport · bcrypt · Swagger · Mercado Pago · Resend · Jest + Supertest · GitHub Actions · Docker · Render · Neon

## Correr el proyecto

### Con Docker (recomendado)

```bash
docker compose up --build
# Datos de ejemplo (admin@barberflow.local / admin123):
docker compose exec api node dist/prisma/seed.js
```

API en http://localhost:3000/v1/health y Swagger en http://localhost:3000/api/docs.

### Sin Docker

```bash
cp .env.example .env        # completar DATABASE_URL y JWT_SECRET
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed             # opcional: datos de ejemplo
npm run start:dev
```

En Windows PowerShell, si aparece un error de ejecución de scripts, usá `npm.cmd` y `npx.cmd`.

## Tests

```bash
npm test                    # unitarios: disponibilidad, firma de Mercado Pago, modo demo
npm run test:e2e            # punta a punta contra Postgres (usar una base de PRUEBA: se vacía)
```

Los tests e2e cubren: registro como ADMIN bloqueado, permisos por rol, 8 reservas simultáneas, margen entre turnos, horario laboral en hora de Argentina, reprogramación y sus límites, aviso a la lista de espera, modo demo (solo lectura y datos ocultos), seña aprobada por webhook firmado, seña vencida y recordatorios. GitHub Actions los corre en cada push y pull request con un PostgreSQL real, y además verifica que las migraciones coincidan con el schema.

## Variables de entorno

Ver [`.env.example`](.env.example). Las únicas obligatorias son `DATABASE_URL` y `JWT_SECRET`. El resto activa funciones opcionales:

| Variable | Para qué |
| --- | --- |
| `DEMO_MODE=true` | Habilita el botón "Probar el panel en modo demo". |
| `CRON_SECRET` | Protege `POST /v1/jobs/run` (lo usa el workflow keep-alive). |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de recordatorios y avisos de lista de espera. Sin clave, solo se loguean. |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Seña con Mercado Pago. Sin token, los turnos se confirman sin seña. |
| `DEPOSIT_PERCENT`, `PAYMENT_TIMEOUT_MINUTES` | Porcentaje de la seña (30 % por defecto) y minutos para pagarla (20). |
| `WEB_URL`, `API_PUBLIC_URL` | Links de los emails y retorno desde Mercado Pago. |

## Deploy (Render)

```text
Build Command:  npm install --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy
Start Command:  npm run start:prod
```

- `--include=dev` hace falta porque con `NODE_ENV=production` npm no instala las herramientas de build (Nest CLI, Prisma).
- `prisma migrate deploy` aplica las migraciones pendientes antes de arrancar la versión nueva.

## Endpoints principales

```text
Auth          POST /v1/auth/register · POST /v1/auth/login · GET /v1/auth/me
              GET|POST /v1/auth/demo
Servicios     GET /v1/services · POST/PATCH/DELETE (admin)
Barberos      GET /v1/barbers · POST /v1/barbers/admin/create · POST /v1/barbers/:id/services
Horarios      GET /v1/working-hours/barber/:id · POST/PATCH/DELETE (admin)
Bloqueos      POST /v1/schedule-blocks · GET /v1/schedule-blocks/barber/:id · DELETE
Disponib.     GET /v1/availability?barberId=&serviceId=&date=
Turnos        POST /v1/appointments · GET /v1/appointments/my · GET /v1/appointments (admin)
              PATCH /v1/appointments/:id/reschedule · PATCH /v1/appointments/:id/cancel
              PATCH /v1/appointments/:id · PATCH /v1/appointments/:id/status (admin)
Seña          GET /v1/payments/config · GET /v1/payments/appointment/:id · POST /v1/payments/webhook
Espera        POST /v1/waitlist · GET /v1/waitlist/my · GET /v1/waitlist (admin) · DELETE /v1/waitlist/:id
Métricas      GET /v1/stats/public
Salud         GET /v1/health · GET /v1/health/db
```

La documentación completa, con ejemplos, está en Swagger.

## Autor

**Ignacio Gabriel Godoy**, desarrollador Backend / Fullstack Jr. · [Portfolio](https://portfolio-ignacio-pi.vercel.app/) · [GitHub](https://github.com/IgnacioGodoy2002)
