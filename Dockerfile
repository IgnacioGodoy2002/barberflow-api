# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build@localhost/build npx prisma generate && npm run build

# ---- runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# Incluye prisma (devDependency) para aplicar las migraciones al arrancar.
RUN npm ci --include=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY prisma ./prisma
COPY prisma.config.ts ./
EXPOSE 3000
# Aplica las migraciones pendientes y arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
