-- CreateEnum
CREATE TYPE "LoadStatus" AS ENUM ('KNITTING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchMovementType" AS ENUM ('PRODUCED', 'DEFECT', 'SALE', 'SALE_CANCEL');

-- CreateEnum
CREATE TYPE "StockSaleKind" AS ENUM ('YARN', 'FINISHED', 'DEFECT');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "autoTransferHours" INTEGER NOT NULL DEFAULT 24,
ALTER COLUMN "disabledModules" SET DEFAULT 'suppliers,rolls,bomProduction,legacy';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "employeeId" TEXT;

-- CreateTable
CREATE TABLE "MachineLoad" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "yarnId" TEXT NOT NULL,
    "gramsPerSock" DOUBLE PRECISION NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "status" "LoadStatus" NOT NULL DEFAULT 'KNITTING',
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "batchId" TEXT,
    "workerId" TEXT,
    "createdById" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "MachineLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "yarnId" TEXT NOT NULL,
    "gramsPerSock" DOUBLE PRECISION NOT NULL,
    "finishedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defectKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "producedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMovement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "BatchMovementType" NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "saleId" TEXT,
    "createdById" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSale" (
    "id" TEXT NOT NULL,
    "kind" "StockSaleKind" NOT NULL,
    "yarnId" TEXT,
    "batchId" TEXT,
    "kg" DOUBLE PRECISION NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "paidAmount" DECIMAL(15,2) NOT NULL,
    "customerId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MachineLoad_organizationId_status_readyAt_idx" ON "MachineLoad"("organizationId", "status", "readyAt");

-- CreateIndex
CREATE INDEX "MachineLoad_machineId_status_idx" ON "MachineLoad"("machineId", "status");

-- CreateIndex
CREATE INDEX "Batch_organizationId_idx" ON "Batch"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_organizationId_date_yarnId_gramsPerSock_key" ON "Batch"("organizationId", "date", "yarnId", "gramsPerSock");

-- CreateIndex
CREATE INDEX "BatchMovement_batchId_idx" ON "BatchMovement"("batchId");

-- CreateIndex
CREATE INDEX "BatchMovement_organizationId_createdAt_idx" ON "BatchMovement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockSale_organizationId_createdAt_idx" ON "StockSale"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineLoad" ADD CONSTRAINT "MachineLoad_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineLoad" ADD CONSTRAINT "MachineLoad_yarnId_fkey" FOREIGN KEY ("yarnId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineLoad" ADD CONSTRAINT "MachineLoad_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineLoad" ADD CONSTRAINT "MachineLoad_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineLoad" ADD CONSTRAINT "MachineLoad_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_yarnId_fkey" FOREIGN KEY ("yarnId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMovement" ADD CONSTRAINT "BatchMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMovement" ADD CONSTRAINT "BatchMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSale" ADD CONSTRAINT "StockSale_yarnId_fkey" FOREIGN KEY ("yarnId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSale" ADD CONSTRAINT "StockSale_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSale" ADD CONSTRAINT "StockSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSale" ADD CONSTRAINT "StockSale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSale" ADD CONSTRAINT "StockSale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mavjud tashkilotlarda ham eski bo'limlar (mahsulot narxlari, ko'p ombor, tarix) yashiriladi
UPDATE "Organization"
SET "disabledModules" = CASE
  WHEN "disabledModules" = '' THEN 'legacy'
  ELSE "disabledModules" || ',legacy'
END
WHERE ',' || "disabledModules" || ',' NOT LIKE '%,legacy,%';
