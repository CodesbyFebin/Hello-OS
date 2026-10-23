FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=file:./db/custom.db
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 DATABASE_URL=file:/app/db/custom.db
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/db ./db
COPY --from=build /app/scripts/runtime-db-init.mjs ./scripts/runtime-db-init.mjs
COPY --from=build /app/prisma/turso/init.sql ./prisma/turso/init.sql
EXPOSE 3000
CMD ["sh", "-c", "node scripts/runtime-db-init.mjs && node server.js"]

FROM oven/bun:1 AS mcp
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production DATABASE_URL=file:/app/db/custom.db PORT=3030
EXPOSE 3030
CMD ["bun", "mini-services/hello-mcp/index.ts"]
