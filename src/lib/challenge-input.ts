import { z } from 'zod';

export const challengeInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(10_000),
  categoryId: z.string().min(1).max(64),
  points: z.number().int().min(1).max(10_000),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  tags: z.array(z.string().trim().min(1).max(24)).max(8),
  flag: z.string().trim().max(256).optional(),
  instanceSlug: z.string().trim().max(100)
    .regex(/^[a-zA-Z0-9._-]*$/, 'VM slug 형식이 올바르지 않습니다.'),
  visible: z.boolean(),
});
