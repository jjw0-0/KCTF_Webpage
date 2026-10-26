ALTER TABLE "challenges"
ADD COLUMN "usesCompose" BOOLEAN NOT NULL DEFAULT false;

UPDATE "challenges"
SET "usesCompose" = true
WHERE "usesVm" = true;
