# BarberFlow API

API REST profesional para BarberFlow, un sistema inteligente de turnos para barbería.

Este backend permite gestionar usuarios, autenticación, roles, barberos, servicios, horarios laborales, disponibilidad dinámica, reservas, cancelaciones y bloqueos de agenda.

## API online

Backend:

https://barberflow-api-9feo.onrender.com

Swagger:

https://barberflow-api-9feo.onrender.com/api/docs

Frontend conectado:

https://barberflow-a0u8cix0l-ignaciogodoy2002s-projects.vercel.app/

Repositorio frontend:

https://github.com/IgnacioGodoy2002/barberflow-web

## Funcionalidades principales

- Autenticación con JWT.
- Registro e inicio de sesión de usuarios.
- Roles de usuario: ADMIN, BARBER y CLIENT.
- Gestión de servicios de barbería.
- Gestión de barberos.
- Asignación de servicios a barberos.
- Configuración de horarios laborales.
- Consulta de disponibilidad por barbero, servicio y fecha.
- Creación de turnos.
- Consulta de turnos propios.
- Consulta general de turnos para administración.
- Cancelación de turnos.
- Bloqueos de agenda.
- Validación de conflictos de horarios.
- Validación de turnos en el pasado.
- Documentación interactiva con Swagger.
- Deploy online en Render.
- Base de datos PostgreSQL en Neon.

## Tecnologías utilizadas

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- JWT
- Passport
- bcrypt
- Swagger
- Render
- Neon
- Node.js

## Arquitectura general

El proyecto está organizado por módulos principales:

```text
src/
├── auth/
├── users/
├── barbers/
├── services/
├── working-hours/
├── availability/
├── appointments/
├── schedule-blocks/
├── prisma/
├── common/
├── app.module.ts
└── main.ts
```

## Endpoints principales

### Auth

```text
POST /v1/auth/register
POST /v1/auth/login
GET  /v1/auth/me
```

### Services

```text
GET    /v1/services
GET    /v1/services/:id
POST   /v1/services
PATCH  /v1/services/:id
DELETE /v1/services/:id
```

### Barbers

```text
GET    /v1/barbers
GET    /v1/barbers/:id
POST   /v1/barbers
PATCH  /v1/barbers/:id
DELETE /v1/barbers/:id
POST   /v1/barbers/:id/services
```

### Working Hours

```text
GET    /v1/working-hours/barber/:barberId
POST   /v1/working-hours
PATCH  /v1/working-hours/:id
DELETE /v1/working-hours/:id
```

### Availability

```text
GET /v1/availability?barberId=&serviceId=&date=
```

### Appointments

```text
POST  /v1/appointments
GET   /v1/appointments/my
GET   /v1/appointments
PATCH /v1/appointments/:id/cancel
```

### Schedule Blocks

```text
POST   /v1/schedule-blocks
GET    /v1/schedule-blocks/barber/:barberId
DELETE /v1/schedule-blocks/:id
```

### Health

```text
GET /v1/health
GET /v1/health/db
```

## Variables de entorno

Crear un archivo `.env` en base a `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="1d"
```

## Instalación local

```bash
npm install
```

En Windows PowerShell, si aparece un error de ejecución de scripts, usar:

```bash
npm.cmd install
```

## Prisma

Generar cliente de Prisma:

```bash
npx prisma generate
```

En Windows PowerShell:

```bash
npx.cmd prisma generate
```

Ejecutar migraciones:

```bash
npx prisma migrate dev
```

En Windows PowerShell:

```bash
npx.cmd prisma migrate dev
```

## Ejecutar en desarrollo

```bash
npm run start:dev
```

En Windows PowerShell:

```bash
npm.cmd run start:dev
```

## Build de producción

```bash
npm run build
```

En Windows PowerShell:

```bash
npm.cmd run build
```

## Deploy

El backend está desplegado en Render.

Configuración utilizada:

```text
Build Command:
npm install && npx prisma generate && npm run build

Start Command:
npm run start:prod
```

Variables configuradas en Render:

```text
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
NODE_VERSION
```

## Demo

El sistema cuenta con frontend online conectado a esta API.  
La documentación interactiva está disponible en Swagger.

> Nota: al estar desplegado en Render Free, la primera carga puede demorar unos segundos si el servicio estaba inactivo.

## Autor

Ignacio Gabriel Godoy

Desarrollador Backend Jr.

Proyecto personal desarrollado conectando experiencia real en barbería con desarrollo backend y frontend fullstack.