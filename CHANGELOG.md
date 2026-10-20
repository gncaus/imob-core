# Changelog

Todas as mudanças relevantes do projeto, por etapa de implementação.

- **Etapa 1:** monorepo (pnpm + Turborepo), Docker Compose (Postgres, Redis, MinIO), Prisma com o modelo de dados inicial, API NestJS com healthcheck e logs pino, painel Next.js mínimo, ESLint, Prettier e Vitest.
- **Etapa 2:** autenticação com JWT em cookie httpOnly (argon2id, limite de tentativas de login, guard global com papéis), CRUD de corretores, erros de domínio com filtro global, seed do admin e testes e2e contra Postgres.
- **Etapa 3:** CRUD de imóveis com os 24 tipos VRSync, fotos no MinIO com URL imutável (hash do conteúdo), ordenação e foto principal, e `portal-readiness` com as regras da documentação oficial do Grupo OLX e testes.
- **Etapa 4:** gerador do feed VRSync atrás da interface `PortalFeedGenerator` (estrutura do exemplo oficial, CDATA, reais inteiros, LotArea/LivingArea), feed público `GET /feeds/vrsync.xml` com cache e ETag, status do feed com motivos de exclusão, e testes de snapshot.
