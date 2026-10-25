export type ChallengeScoring = {
  points: number;
  scoringMode: 'STATIC' | 'DYNAMIC' | 'LINEAR';
  minimumPoints: number;
  decaySolves: number;
  decrementPerSolve: number;
};

export function calculateChallengePoints(challenge: ChallengeScoring, solveCount: number) {
  if (challenge.scoringMode === 'STATIC' || solveCount <= 1) return challenge.points;
  const minimum = Math.min(challenge.points, challenge.minimumPoints);

  if (challenge.scoringMode === 'LINEAR') {
    return Math.max(minimum, challenge.points - (solveCount - 1) * challenge.decrementPerSolve);
  }

  const progress = Math.min(1, (solveCount - 1) / Math.max(1, challenge.decaySolves - 1));
  return Math.max(minimum, Math.round(challenge.points + (minimum - challenge.points) * progress ** 2));
}
