import { createPropertySchema } from '@imob/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { hashPassword } from '../src/common/auth/password.js';
import { parseConfig } from '../src/common/config/env.js';
import { S3PhotoStorage } from '../src/common/storage/s3-photo-storage.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PHOTO_CONTENT_TYPE } from '../src/modules/properties/portal-readiness.js';
import { photoStorageKey } from '../src/modules/properties/property-photos.service.js';
import { SEED_AGENTS, SEED_PROPERTIES, type SeedProperty } from './seed-data.js';
import { placeholderPhoto } from './seed-photos.js';

// O prisma.config.ts já carregou o .env da raiz antes de chamar o seed.
const env = z
  .object({
    SEED_ADMIN_NAME: z.string().min(1).default('Administrador'),
    SEED_ADMIN_EMAIL: z.email().default('admin@imob.local'),
    SEED_ADMIN_PASSWORD: z.string().min(8),
    SEED_AGENT_PASSWORD: z.string().min(8).default('corretor12345'),
  })
  .parse(process.env);
const config = parseConfig(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});
const storage = new S3PhotoStorage(config);

/** Idempotente: rodar o seed de novo atualiza os registros em vez de duplicar. */
async function seedAdmin(): Promise<void> {
  const email = env.SEED_ADMIN_EMAIL.toLowerCase();
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email },
    update: { name: env.SEED_ADMIN_NAME, passwordHash },
    create: { name: env.SEED_ADMIN_NAME, email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Admin: ${email}`);
}

async function seedAgents(): Promise<void> {
  const passwordHash = await hashPassword(env.SEED_AGENT_PASSWORD);
  for (const agent of SEED_AGENTS) {
    const user = await prisma.user.upsert({
      where: { email: agent.email },
      update: { name: agent.name, passwordHash, role: 'AGENT' },
      create: { name: agent.name, email: agent.email, passwordHash, role: 'AGENT' },
    });
    await prisma.agent.upsert({
      where: { userId: user.id },
      update: { queue: agent.queue, whatsapp: agent.whatsapp, active: true },
      create: { userId: user.id, queue: agent.queue, whatsapp: agent.whatsapp },
    });
  }
  console.log(`Corretores: ${SEED_AGENTS.length} (senha: ${env.SEED_AGENT_PASSWORD})`);
}

/** As fotos são determinísticas: mesma imagem, mesmo hash, mesma chave no storage. */
async function seedPhotos(propertyId: string, { hue, photoCount }: SeedProperty): Promise<void> {
  await prisma.propertyPhoto.deleteMany({ where: { propertyId } });
  for (let position = 0; position < photoCount; position++) {
    const content = placeholderPhoto(hue, position);
    const storageKey = photoStorageKey(propertyId, content);
    await storage.put(storageKey, content, PHOTO_CONTENT_TYPE);
    await prisma.propertyPhoto.create({
      data: {
        propertyId,
        storageKey,
        contentType: PHOTO_CONTENT_TYPE,
        sizeBytes: content.length,
        position,
        isPrimary: position === 0,
      },
    });
  }
}

async function seedProperties(): Promise<void> {
  for (const seed of SEED_PROPERTIES) {
    // Mesma validação e normalização da API.
    const data = createPropertySchema.parse(seed.data);
    const property = await prisma.property.upsert({
      where: { code: data.code },
      update: data,
      create: data,
    });
    await seedPhotos(property.id, seed);
    console.log(`Imóvel ${data.code}: ${seed.photoCount} fotos`);
  }
}

async function main(): Promise<void> {
  await storage.onModuleInit();
  await seedAdmin();
  await seedAgents();
  await seedProperties();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
