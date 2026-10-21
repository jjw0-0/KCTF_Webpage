CREATE TYPE "ChallengeDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

ALTER TABLE "challenges" RENAME COLUMN "flag" TO "flagHash";
ALTER TABLE "challenges"
  ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "difficulty" "ChallengeDifficulty" NOT NULL DEFAULT 'INTERMEDIATE',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "instanceSlug" TEXT;

ALTER TABLE "submissions" RENAME COLUMN "flag" TO "flagDigest";

CREATE TABLE "solves" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "solves_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "challenges_instanceSlug_key" ON "challenges"("instanceSlug");
CREATE UNIQUE INDEX "solves_challengeId_userId_key" ON "solves"("challengeId", "userId");
CREATE INDEX "solves_userId_solvedAt_idx" ON "solves"("userId", "solvedAt");
CREATE INDEX "solves_solvedAt_idx" ON "solves"("solvedAt");

ALTER TABLE "solves" ADD CONSTRAINT "solves_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solves" ADD CONSTRAINT "solves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
