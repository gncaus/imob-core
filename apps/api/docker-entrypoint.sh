#!/bin/sh
# Prepara o banco e sobe a API. Roda a cada início do container:
# as migrações são idempotentes e o seed só popula um banco vazio (SEED_ONLY_IF_EMPTY).
set -e

pnpm exec prisma migrate deploy
SEED_ONLY_IF_EMPTY=true pnpm exec prisma db seed

exec node dist/main.js
