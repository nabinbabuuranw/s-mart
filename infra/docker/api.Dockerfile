# WRITTEN, NOT EXECUTED on the authoring box (Docker is not installed there).
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/customer-web/package.json apps/customer-web/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate --schema prisma/schema.prisma \
 && npm run build:shared && npm run build -w @smart/api

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production
WORKDIR /app
# postgresql-client is only needed for the admin "backup" endpoints (pg_dump / pg_restore).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client \
 && rm -rf /var/lib/apt/lists/* && mkdir -p /data/uploads /data/backups && chown -R node:node /data /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 4100
# Migrations are applied at start (prisma migrate deploy is idempotent), then the API boots.
CMD ["sh","-c","npx prisma migrate deploy --schema prisma/schema.prisma && node apps/api/dist/main.js"]
