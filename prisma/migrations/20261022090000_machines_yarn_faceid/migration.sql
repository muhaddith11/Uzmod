-- CreateEnum
CREATE TYPE "MachineRunStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MachineEventType" AS ENUM ('ISSUE', 'COUNT', 'RETURN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'TO_MACHINE';
ALTER TYPE "MovementType" ADD VALUE 'FROM_MACHINE';

-- AlterEnum
ALTER TYPE "AttendanceSource" ADD VALUE 'DEVICE';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "disabledModules" TEXT NOT NULL DEFAULT 'suppliers,rolls,bomProduction';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceUserId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "color" TEXT,
ADD COLUMN     "yarnType" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "machineRunId" TEXT;

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "group" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineRun" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "yarnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "gramsPerSock" DOUBLE PRECISION NOT NULL,
    "status" "MachineRunStatus" NOT NULL DEFAULT 'OPEN',
    "issuedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "countedPairs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leftoverKg" DOUBLE PRECISION,
    "rawWarehouseId" TEXT NOT NULL,
    "goodsWarehouseId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "closedById" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "MachineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "MachineEventType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "workerId" TEXT,
    "createdById" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDevice" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePunch" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "rawStatus" INTEGER,
    "verify" INTEGER,
    "userId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Machine_organizationId_idx" ON "Machine"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_organizationId_number_key" ON "Machine"("organizationId", "number");

-- CreateIndex
CREATE INDEX "MachineRun_organizationId_status_idx" ON "MachineRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MachineRun_machineId_status_idx" ON "MachineRun"("machineId", "status");

-- CreateIndex
CREATE INDEX "MachineRunEvent_runId_idx" ON "MachineRunEvent"("runId");

-- CreateIndex
CREATE INDEX "MachineRunEvent_organizationId_createdAt_idx" ON "MachineRunEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_serialNumber_key" ON "AttendanceDevice"("serialNumber");

-- CreateIndex
CREATE INDEX "AttendanceDevice_organizationId_idx" ON "AttendanceDevice"("organizationId");

-- CreateIndex
CREATE INDEX "DevicePunch_organizationId_punchedAt_idx" ON "DevicePunch"("organizationId", "punchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePunch_deviceId_pin_punchedAt_key" ON "DevicePunch"("deviceId", "pin", "punchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_deviceUserId_key" ON "User"("organizationId", "deviceUserId");

-- CreateIndex
CREATE INDEX "StockMovement_machineRunId_idx" ON "StockMovement"("machineRunId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_machineRunId_fkey" FOREIGN KEY ("machineRunId") REFERENCES "MachineRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRun" ADD CONSTRAINT "MachineRun_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRun" ADD CONSTRAINT "MachineRun_yarnId_fkey" FOREIGN KEY ("yarnId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRun" ADD CONSTRAINT "MachineRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRun" ADD CONSTRAINT "MachineRun_rawWarehouseId_fkey" FOREIGN KEY ("rawWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRun" ADD CONSTRAINT "MachineRun_goodsWarehouseId_fkey" FOREIGN KEY ("goodsWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRun" ADD CONSTRAINT "MachineRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRunEvent" ADD CONSTRAINT "MachineRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MachineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRunEvent" ADD CONSTRAINT "MachineRunEvent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRunEvent" ADD CONSTRAINT "MachineRunEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineRunEvent" ADD CONSTRAINT "MachineRunEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePunch" ADD CONSTRAINT "DevicePunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AttendanceDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePunch" ADD CONSTRAINT "DevicePunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePunch" ADD CONSTRAINT "DevicePunch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

