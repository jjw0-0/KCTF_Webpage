CREATE TYPE "ChallengeConnectionType" AS ENUM ('HTTP', 'TCP');

ALTER TABLE "challenges"
ADD COLUMN "connectionType" "ChallengeConnectionType" NOT NULL DEFAULT 'HTTP';
