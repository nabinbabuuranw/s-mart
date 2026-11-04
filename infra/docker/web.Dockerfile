# One Dockerfile for both Next.js apps:  --build-arg APP=admin-web | customer-web
# WRITTEN, NOT EXECUTED on the authoring box (Docker is not installed there).
# Uses "next start". The apps do not set output:'standalone' in their next.config at time of writing;
# add it and switch CMD to "node apps/<app>/server.js" for a smaller image.
FROM node:22-bookworm-slim AS build
ARG APP=customer-web
ARG NEXT_PUBLIC_API_URL=http://localhost:4100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/customer-web/package.json apps/customer-web/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build:shared && npm run build -w @smart/$APP

FROM node:22-bookworm-slim AS run
ARG APP=customer-web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP=$APP
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["sh","-c","npm run start -w @smart/$APP -- -p 3000"]
