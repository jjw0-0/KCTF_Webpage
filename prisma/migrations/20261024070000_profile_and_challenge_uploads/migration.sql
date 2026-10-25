ALTER TABLE "users" ADD COLUMN "avatarData" TEXT;

ALTER TABLE "challenges"
  ADD COLUMN "usesVm" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "connectionUrl" TEXT,
  ADD COLUMN "attachmentName" TEXT,
  ADD COLUMN "attachmentMimeType" TEXT,
  ADD COLUMN "attachmentSize" INTEGER,
  ADD COLUMN "attachmentData" BYTEA;

UPDATE "challenges" SET "usesVm" = true WHERE "instanceSlug" IS NOT NULL;
