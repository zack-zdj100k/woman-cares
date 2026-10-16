-- AlterTable
ALTER TABLE "ProviderAccount" ADD COLUMN     "reviewNote" TEXT;

-- AlterTable
ALTER TABLE "ProviderCategoryRequest" ADD COLUMN     "decisionNote" TEXT;

-- AlterTable
ALTER TABLE "ProviderServiceProfile" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMPTZ;
