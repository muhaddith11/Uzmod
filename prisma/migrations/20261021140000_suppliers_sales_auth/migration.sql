-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "subscription";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "saleId" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "unitCost" DECIMAL(15,2),
ADD COLUMN     "unitWage" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "DebtPayment" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "StaffAdjustment" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "supplierId" TEXT NOT NULL,
    "createdById" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");

-- CreateIndex
CREATE INDEX "SupplierPayment_organizationId_idx" ON "SupplierPayment"("organizationId");

-- CreateIndex
CREATE INDEX "SupplierPayment_organizationId_createdAt_idx" ON "SupplierPayment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "StockMovement_supplierId_idx" ON "StockMovement"("supplierId");

-- CreateIndex
CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdjustment" ADD CONSTRAINT "StaffAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

