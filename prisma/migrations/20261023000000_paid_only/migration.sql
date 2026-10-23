-- Free time stopped for a professional: her profiles are visible only while a paid month covers today.
ALTER TABLE "ProviderSubscription" ADD COLUMN "paidOnly" BOOLEAN NOT NULL DEFAULT false;
