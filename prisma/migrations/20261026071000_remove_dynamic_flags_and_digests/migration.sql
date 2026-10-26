ALTER TABLE "challenges"
DROP COLUMN "dynamicFlag",
DROP COLUMN "flagHash";

ALTER TABLE "submissions" DROP COLUMN "flagDigest";
