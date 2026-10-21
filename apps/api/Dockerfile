# API (NestJS) + worker de roteamento. Build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile .
# A imagem mantém as dependências de desenvolvimento porque o entrypoint aplica as migrações
# (Prisma CLI) e roda o seed (tsx), para a demonstração subir com um comando.
FROM node:22-bookworm-slim

# OpenSSL: exigido pelo motor de migrações do Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY . .
# Workspace completo: o TypeScript e o turbo ficam na raiz do monorepo.
RUN pnpm install --frozen-lockfile && pnpm --filter @imob/api build

ENV NODE_ENV=production
EXPOSE 3333
WORKDIR /app/apps/api
CMD ["sh", "./docker-entrypoint.sh"]
