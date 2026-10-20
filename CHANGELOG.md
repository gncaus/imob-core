# Changelog

Todas as mudanças relevantes do projeto, por etapa de implementação.

- **Etapa 1:** monorepo (pnpm + Turborepo), Docker Compose (Postgres, Redis, MinIO), Prisma com o modelo de dados inicial, API NestJS com healthcheck e logs pino, painel Next.js mínimo, ESLint, Prettier e Vitest.
- **Etapa 2:** autenticação com JWT em cookie httpOnly (argon2id, limite de tentativas de login, guard global com papéis), CRUD de corretores, erros de domínio com filtro global, seed do admin e testes e2e contra Postgres.
