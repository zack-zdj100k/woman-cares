-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "declaredById" UUID,
ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_subscriptionId_periodStart_key" ON "Invoice"("subscriptionId", "periodStart");
