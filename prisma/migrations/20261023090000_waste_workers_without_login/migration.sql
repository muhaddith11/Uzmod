-- AlterEnum
ALTER TYPE "BatchMovementType" ADD VALUE 'WASTE';

-- AlterEnum
ALTER TYPE "StockSaleKind" ADD VALUE 'WASTE';

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "wasteKg" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;
