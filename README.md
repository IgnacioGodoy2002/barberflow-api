# BarberFlow API

API REST para gestión inteligente de turnos de barbería.

Este proyecto conecta mi experiencia real como barbero con mi formación en desarrollo backend. El objetivo es construir una plataforma moderna para administrar clientes, barberos, servicios, horarios disponibles, reservas, cancelaciones y disponibilidad dinámica.

## Deploy

API online:

https://barberflow-api-9feo.onrender.com

Swagger online:

https://barberflow-api-9feo.onrender.com/api/docs

Health check:

https://barberflow-api-9feo.onrender.com/v1/health
## Tecnologías utilizadas

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- Prisma ORM
- JWT Authentication
- Role Based Access Control
- Swagger
- Neon PostgreSQL
- Git / GitHub

## Funcionalidades principales

- Registro e inicio de sesión de usuarios.
- Autenticación con JWT.
- Roles de usuario: ADMIN, BARBER y CLIENT.
- Gestión de servicios de barbería.
- Gestión de perfiles de barberos.
- Asignación de servicios a barberos.
- Gestión de horarios laborales por barbero.
- Motor de disponibilidad dinámica.
- Creación de reservas de turnos.
- Cancelación de turnos.
- Validación de conflictos para evitar doble reserva.
- Documentación interactiva con Swagger.

## Roles del sistema

### ADMIN

Puede administrar servicios, barberos, horarios y visualizar turnos.

### BARBER

Representa a un barbero dentro del sistema.

### CLIENT

Puede consultar disponibilidad, reservar turnos y ver sus reservas.

## Endpoints principales

### Auth

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`

### Services

- `GET /v1/services`
- `GET /v1/services/:id`
- `POST /v1/services`
- `PATCH /v1/services/:id`
- `DELETE /v1/services/:id`

### Barbers

- `GET /v1/barbers`
- `GET /v1/barbers/:id`
- `POST /v1/barbers`
- `PATCH /v1/barbers/:id`
- `DELETE /v1/barbers/:id`
- `POST /v1/barbers/:id/services`

### Working Hours

- `GET /v1/working-hours/barber/:barberId`
- `POST /v1/working-hours`
- `PATCH /v1/working-hours/:id`
- `DELETE /v1/working-hours/:id`

### Availability

- `GET /v1/availability`

### Appointments

- `POST /v1/appointments`
- `GET /v1/appointments/my`
- `GET /v1/appointments`
- `PATCH /v1/appointments/:id/cancel`

## Motor de disponibilidad

La API calcula horarios disponibles teniendo en cuenta:

- Horarios laborales del barbero.
- Servicio seleccionado.
- Duración del servicio.
- Tiempo de buffer entre turnos.
- Turnos ya reservados.
- Turnos cancelados.
- Evita superposición de reservas.

Ejemplo:

Un servicio de 50 minutos con 10 minutos de buffer genera turnos cada 60 minutos.

## Seguridad

- Contraseñas encriptadas con bcrypt.
- Autenticación mediante JWT.
- Rutas protegidas con guards.
- Validación de roles.
- Validación de datos con class-validator.
- Variables sensibles protegidas mediante `.env`.

## Documentación Swagger

Una vez iniciado el servidor, la documentación está disponible en:

```text
http://localhost:3000/api/docs