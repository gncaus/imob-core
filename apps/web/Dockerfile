# Painel (Next.js). Build a partir da raiz do monorepo:
#   docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:3333 .
FROM node:22-bookworm-slim
RUN corepack enable

WORKDIR /app
COPY . .
# Workspace completo: o TypeScript fica na raiz do monorepo.
RUN pnpm install --frozen-lockfile

# O proxy /api/* do painel é fixado no build: aponta para a API dentro da rede do compose.
ARG API_URL=http://api:3333
ENV API_URL=${API_URL} \
  NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @imob/web build

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "exec", "next", "start", "--port", "3000"]
