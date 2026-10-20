import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { hashPassword } from '../src/common/auth/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// O prisma.config.ts já carregou o .env da raiz antes de chamar o seed.
const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    SEED_ADMIN_NAME: z.string().min(1).default('Administrador'),
    SEED_ADMIN_EMAIL: z.email().default('admin@imob.local'),
    SEED_ADMIN_PASSWORD: z.string().min(8),
  })
  .parse(process.env);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

async function seedAdmin(): Promise<void> {
  const email = env.SEED_ADMIN_EMAIL.toLowerCase();
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  // Idempotente: rodar o seed de novo redefine nome e senha do admin.
  await prisma.user.upsert({
    where: { email },
    update: { name: env.SEED_ADMIN_NAME, passwordHash },
    create: { name: env.SEED_ADMIN_NAME, email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Admin pronto: ${email}`);
}

async function main(): Promise<void> {
  await seedAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
