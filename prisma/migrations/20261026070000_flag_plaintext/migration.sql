ALTER TABLE "challenges" ADD COLUMN "flag" TEXT;
ALTER TABLE "challenges" ALTER COLUMN "flagHash" DROP NOT NULL;
