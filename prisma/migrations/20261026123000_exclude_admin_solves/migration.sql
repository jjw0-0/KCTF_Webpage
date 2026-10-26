WITH participant_counts AS (
  SELECT
    challenge.id AS "challengeId",
    COUNT(solver.id)::INTEGER AS "solveCount"
  FROM "challenges" AS challenge
  LEFT JOIN "solves" AS solve
    ON solve."challengeId" = challenge.id
  LEFT JOIN "users" AS solver
    ON solver.id = solve."userId"
    AND solver.role = 'USER'
  GROUP BY challenge.id
)
UPDATE "challenges" AS challenge
SET "solveCount" = participant_counts."solveCount"
FROM participant_counts
WHERE participant_counts."challengeId" = challenge.id;

UPDATE "solves" AS solve
SET points = CASE challenge."scoringMode"
  WHEN 'STATIC' THEN challenge.points
  WHEN 'LINEAR' THEN GREATEST(
    LEAST(challenge.points, challenge."minimumPoints"),
    challenge.points - GREATEST(challenge."solveCount" - 1, 0) * challenge."decrementPerSolve"
  )
  ELSE GREATEST(
    LEAST(challenge.points, challenge."minimumPoints"),
    ROUND(
      challenge.points
      + (LEAST(challenge.points, challenge."minimumPoints") - challenge.points)
      * POWER(
        LEAST(
          1.0,
          GREATEST(challenge."solveCount" - 1, 0)::NUMERIC
          / GREATEST(challenge."decaySolves" - 1, 1)
        ),
        2
      )
    )::INTEGER
  )
END
FROM "challenges" AS challenge
WHERE challenge.id = solve."challengeId";
