-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ONLINE',
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProviderAccount" ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "publicEmail" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "ProviderServiceProfile" ADD COLUMN     "slotMinutes" INTEGER,
ADD COLUMN     "startingPriceManual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "coveredFrom" TIMESTAMPTZ,
ADD COLUMN     "coveredTo" TIMESTAMPTZ,
ADD COLUMN     "receiptKey" TEXT,
ADD COLUMN     "receiptNote" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT;

-- A booking belongs to a client account or names a client added by hand.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_client_or_guest" CHECK ("clientId" IS NOT NULL OR "guestName" IS NOT NULL);
