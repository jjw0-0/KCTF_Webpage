import { z } from 'zod';
import { safeResourceUrl } from './challenge-media.ts';

export const challengeInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  summary: z.string().trim().max(300).default(''),
  description: z.string().trim().min(1).max(10_000),
  author: z.string().trim().max(80).optional(),
  fileUrl: z.string().trim().max(2048)
    .refine((value) => !value || Boolean(safeResourceUrl(value)), '파일 URL은 http(s) 주소 또는 /로 시작하는 경로를 입력해 주세요.')
    .default(''),
  categoryId: z.string().min(1).max(64),
  points: z.number().int().min(1).max(10_000),
  scoringMode: z.enum(['STATIC', 'DYNAMIC', 'LINEAR']).default('STATIC'),
  minimumPoints: z.number().int().min(1).max(10_000).default(50),
  decaySolves: z.number().int().min(2).max(100_000).default(20),
  decrementPerSolve: z.number().int().min(1).max(10_000).default(10),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('INTERMEDIATE'),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  flag: z.string().trim().max(256).optional(),
  instanceSlug: z.string().trim().max(100)
    .regex(/^[a-zA-Z0-9._-]*$/, 'VM slug 형식이 올바르지 않습니다.').default(''),
  usesVm: z.boolean().default(false),
  dynamicFlag: z.boolean().default(false),
  instancePort: z.number().int().min(1).max(65_535).optional(),
  connectionUrl: z.string().trim().max(2048)
    .refine((value) => {
      if (!value) return true;
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, '접속 URL은 http 또는 https 주소를 입력해 주세요.').default(''),
  visible: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.usesVm && value.connectionUrl) {
    context.addIssue({ code: 'custom', path: ['connectionUrl'], message: 'VM 사용과 직접 URL은 동시에 설정할 수 없습니다.' });
  }
  if (!value.usesVm && value.dynamicFlag) {
    context.addIssue({ code: 'custom', path: ['dynamicFlag'], message: '플레이어별 플래그는 VM 문제에서만 사용할 수 있습니다.' });
  }
  if (value.usesVm && !value.instancePort) {
    context.addIssue({ code: 'custom', path: ['instancePort'], message: 'VM 연결 포트를 입력해 주세요.' });
  }
  if (value.scoringMode !== 'STATIC' && value.minimumPoints >= value.points) {
    context.addIssue({ code: 'custom', path: ['minimumPoints'], message: '최저 점수는 시작 점수보다 낮아야 합니다.' });
  }
});

export function deriveChallengeSummary(description: string) {
  return description
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[`#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}
