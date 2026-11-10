ALTER TABLE "users" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "accessTokenPrefix" TEXT;

ALTER TABLE "teams" ADD COLUMN "ctfId" TEXT;
ALTER TABLE "teams" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "teams" ADD COLUMN "accessTokenPrefix" TEXT;
UPDATE "teams" SET "ctfId" = 'kctf-2026';
ALTER TABLE "teams" ALTER COLUMN "ctfId" SET NOT NULL;

DROP INDEX "challenge_instances_userId_key";
ALTER TABLE "challenge_instances" ADD COLUMN "ownerKey" TEXT;
ALTER TABLE "challenge_instances" ADD COLUMN "teamId" TEXT;
ALTER TABLE "challenge_instances" ADD COLUMN "requestIp" TEXT;
ALTER TABLE "challenge_instances" ADD COLUMN "tokenPrefix" TEXT;
UPDATE "challenge_instances" SET "ownerKey" = 'user:' || "userId";
ALTER TABLE "challenge_instances" ALTER COLUMN "ownerKey" SET NOT NULL;

ALTER TABLE "challenges" ADD COLUMN "dynamicFlag" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "submissions" ADD COLUMN "ownerKey" TEXT;
ALTER TABLE "submissions" ADD COLUMN "tokenPrefix" TEXT;
ALTER TABLE "submissions" ADD COLUMN "ipAddress" TEXT;
UPDATE "submissions" SET "ownerKey" = 'user:' || "userId";
ALTER TABLE "submissions" ALTER COLUMN "ownerKey" SET NOT NULL;

DROP INDEX "solves_challengeId_userId_key";
DROP INDEX "teams_name_key";
ALTER TABLE "solves" ADD COLUMN "ownerKey" TEXT;
ALTER TABLE "solves" ADD COLUMN "teamId" TEXT;
UPDATE "solves" SET "ownerKey" = 'user:' || "userId";
ALTER TABLE "solves" ALTER COLUMN "ownerKey" SET NOT NULL;

CREATE UNIQUE INDEX "users_accessTokenHash_key" ON "users"("accessTokenHash");
CREATE UNIQUE INDEX "teams_accessTokenHash_key" ON "teams"("accessTokenHash");
CREATE UNIQUE INDEX "teams_ctfId_name_key" ON "teams"("ctfId", "name");
CREATE UNIQUE INDEX "challenge_instances_ownerKey_key" ON "challenge_instances"("ownerKey");
CREATE INDEX "challenge_instances_requestIp_idx" ON "challenge_instances"("requestIp");
CREATE INDEX "challenge_instances_tokenPrefix_idx" ON "challenge_instances"("tokenPrefix");
CREATE INDEX "submissions_ipAddress_idx" ON "submissions"("ipAddress");
CREATE INDEX "submissions_tokenPrefix_idx" ON "submissions"("tokenPrefix");
CREATE UNIQUE INDEX "solves_challengeId_ownerKey_key" ON "solves"("challengeId", "ownerKey");

ALTER TABLE "teams" ADD CONSTRAINT "teams_ctfId_fkey" FOREIGN KEY ("ctfId") REFERENCES "ctfs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solves" ADD CONSTRAINT "solves_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
