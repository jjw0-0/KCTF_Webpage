CREATE TYPE "DeploymentStatus" AS ENUM ('NONE', 'QUEUED', 'BUILDING', 'READY', 'FAILED');

ALTER TABLE "challenges"
ADD COLUMN "deploymentStatus" "DeploymentStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "deploymentError" TEXT,
ADD COLUMN "deploymentUpdatedAt" TIMESTAMP(3),
ADD COLUMN "dynamicFlag" BOOLEAN NOT NULL DEFAULT false;
