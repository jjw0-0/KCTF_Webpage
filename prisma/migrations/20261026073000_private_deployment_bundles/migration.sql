ALTER TABLE "challenges"
ADD COLUMN "deploymentName" TEXT,
ADD COLUMN "deploymentMimeType" TEXT,
ADD COLUMN "deploymentSize" INTEGER,
ADD COLUMN "deploymentData" BYTEA;
