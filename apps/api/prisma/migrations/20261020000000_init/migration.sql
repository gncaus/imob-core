-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentQueue" AS ENUM ('RENTAL', 'SALES');

-- CreateEnum
CREATE TYPE "LeadQueue" AS ENUM ('RENTAL', 'SALES', 'TRIAGE');

-- CreateEnum
CREATE TYPE "PropertyPurpose" AS ENUM ('SALE', 'RENT', 'SALE_RENT');

-- CreateEnum
CREATE TYPE "DisplayAddress" AS ENUM ('ALL', 'STREET', 'NEIGHBORHOOD');

-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('STANDARD', 'PREMIUM', 'SUPER_PREMIUM', 'PREMIERE_1', 'PREMIERE_2', 'TRIPLE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('GRUPO_OLX', 'SITE', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadTransactionType" AS ENUM ('RENT', 'SELL');

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('RECEIVED', 'ROUTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "queue" "AgentQueue" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp" TEXT NOT NULL,
    "lastLeadAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "purpose" "PropertyPurpose" NOT NULL,
    "propertyType" TEXT,
    "propertySubtype" TEXT,
    "salePriceCents" BIGINT,
    "rentPriceCents" INTEGER,
    "condoFeeCents" INTEGER,
    "iptuCents" INTEGER,
    "usableArea" DECIMAL(10,2),
    "totalArea" DECIMAL(10,2),
    "bedrooms" INTEGER,
    "suites" INTEGER,
    "bathrooms" INTEGER,
    "parkingSpots" INTEGER,
    "postalCode" VARCHAR(8),
    "state" VARCHAR(2),
    "city" TEXT,
    "neighborhood" TEXT,
    "street" TEXT,
    "streetNumber" TEXT,
    "complement" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "displayAddress" "DisplayAddress" NOT NULL DEFAULT 'ALL',
    "publicationType" "PublicationType" NOT NULL DEFAULT 'STANDARD',
    "publishToPortals" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "caption" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "source" "LeadSource" NOT NULL,
    "originLeadId" TEXT,
    "clientListingId" TEXT,
    "propertyId" UUID,
    "name" TEXT,
    "email" TEXT,
    "ddd" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "transactionType" "LeadTransactionType",
    "leadType" TEXT,
    "temperature" "LeadTemperature",
    "isSimilarListing" BOOLEAN NOT NULL DEFAULT false,
    "queue" "LeadQueue",
    "agentId" UUID,
    "routingReason" TEXT,
    "rawPayload" JSONB NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'RECEIVED',
    "routedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agents_userId_key" ON "agents"("userId");

-- CreateIndex
CREATE INDEX "agents_queue_active_lastLeadAt_idx" ON "agents"("queue", "active", "lastLeadAt");

-- CreateIndex
CREATE UNIQUE INDEX "properties_code_key" ON "properties"("code");

-- CreateIndex
CREATE INDEX "properties_publishToPortals_idx" ON "properties"("publishToPortals");

-- CreateIndex
CREATE UNIQUE INDEX "property_photos_storageKey_key" ON "property_photos"("storageKey");

-- CreateIndex
CREATE INDEX "property_photos_propertyId_position_idx" ON "property_photos"("propertyId", "position");

-- CreateIndex
CREATE INDEX "leads_queue_status_createdAt_idx" ON "leads"("queue", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leads_source_originLeadId_key" ON "leads"("source", "originLeadId");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
