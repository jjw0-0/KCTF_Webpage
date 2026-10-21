export type Category = {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  description: string;
  color: string;
  order: number;
  visible: boolean;
};

export type Challenge = {
  id: string;
  title: string;
  summary: string;
  category: string;
  points: number;
  solves: number;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  solved?: boolean;
  tags: string[];
};

export const event = {
  name: 'KCTF 2026',
  season: 'K.knock internal CTF',
  startsAt: '2026-12-10T10:00:00+09:00',
  endsAt: '2026-12-13T22:00:00+09:00',
  status: 'REGISTRATION OPEN',
};

export const defaultCategories: Category[] = [
  {
    id: 'cat-web',
    name: 'Web',
    slug: 'web',
    shortName: 'WEB',
    description: '웹 서비스의 경계를 읽고, 입력과 신뢰 사이의 틈을 공략합니다.',
    color: '#4de0a7',
    order: 1,
    visible: true,
  },
  {
    id: 'cat-pwn',
    name: 'Pwnable',
    slug: 'pwn',
    shortName: 'PWN',
    description: '메모리, 실행 흐름, 시스템의 가장 낮은 층을 장악합니다.',
    color: '#76f2c1',
    order: 2,
    visible: true,
  },
  {
    id: 'cat-rev',
    name: 'Reversing',
    slug: 'rev',
    shortName: 'REV',
    description: '바이너리의 흔적을 되짚어 숨겨진 의도를 복원합니다.',
    color: '#39c690',
    order: 3,
    visible: true,
  },
  {
    id: 'cat-crypto',
    name: 'Cryptography',
    slug: 'crypto',
    shortName: 'CRYPTO',
    description: '수학적 약점과 구현의 실수를 찾아 암호를 해독합니다.',
    color: '#20a878',
    order: 4,
    visible: true,
  },
  {
    id: 'cat-ai',
    name: 'AI Security',
    slug: 'ai',
    shortName: 'AI',
    description: '모델과 에이전트의 새로운 공격 표면을 분석합니다.',
    color: '#8fffd3',
    order: 5,
    visible: true,
  },
  {
    id: 'cat-web3',
    name: 'Web3',
    slug: 'web3',
    shortName: 'WEB3',
    description: '스마트 컨트랙트와 온체인 로직의 허점을 찾습니다.',
    color: '#5ceab0',
    order: 6,
    visible: true,
  },
  {
    id: 'cat-misc',
    name: 'Miscellaneous',
    slug: 'misc',
    shortName: 'MISC',
    description: '정해진 틀 바깥의 관찰력과 창의성을 겨룹니다.',
    color: '#30bd88',
    order: 7,
    visible: true,
  },
];

export const challenges: Challenge[] = [
  {
    id: 'request-smuggler',
    title: 'Request Smuggler',
    summary: '서로 다른 프록시 해석을 연결해 내부 경로를 찾아내세요.',
    category: 'web',
    points: 450,
    solves: 7,
    difficulty: 'ADVANCED',
    tags: ['HTTP', 'PROXY'],
  },
  {
    id: 'redis-race',
    title: 'Redis Race',
    summary: '짧은 동시성 틈을 이용해 세션 상태를 뒤집어 보세요.',
    category: 'web',
    points: 300,
    solves: 18,
    difficulty: 'INTERMEDIATE',
    tags: ['RACE', 'SESSION'],
  },
  {
    id: 'tiny-proxy',
    title: 'Tiny Proxy',
    summary: '작고 안전해 보이는 프록시에 숨은 신뢰 경계를 공략하세요.',
    category: 'web',
    points: 200,
    solves: 34,
    difficulty: 'BEGINNER',
    solved: true,
    tags: ['SSRF', 'URL'],
  },
  {
    id: 'signal-lost',
    title: 'Signal Lost',
    summary: '제한된 출력만으로 원격 프로세스의 상태를 복구하세요.',
    category: 'pwn',
    points: 500,
    solves: 4,
    difficulty: 'ADVANCED',
    tags: ['HEAP', 'GLIBC'],
  },
  {
    id: 'one-byte-away',
    title: 'One Byte Away',
    summary: '단 한 바이트의 오염으로 실행 흐름을 탈취하세요.',
    category: 'pwn',
    points: 350,
    solves: 12,
    difficulty: 'INTERMEDIATE',
    tags: ['STACK', 'ROP'],
  },
  {
    id: 'paper-machine',
    title: 'Paper Machine',
    summary: '가상 머신 명령어를 분석해 검사 루틴을 우회하세요.',
    category: 'rev',
    points: 400,
    solves: 9,
    difficulty: 'ADVANCED',
    tags: ['VM', 'BYTECODE'],
  },
  {
    id: 'clockwork',
    title: 'Clockwork',
    summary: '시간에 따라 변하는 상태 머신의 규칙을 찾아내세요.',
    category: 'rev',
    points: 250,
    solves: 27,
    difficulty: 'INTERMEDIATE',
    tags: ['ELF', 'STATE'],
  },
  {
    id: 'shared-secret',
    title: 'Shared Secret',
    summary: '재사용된 비밀과 작은 편향이 남긴 패턴을 추적하세요.',
    category: 'crypto',
    points: 300,
    solves: 16,
    difficulty: 'INTERMEDIATE',
    tags: ['ECDSA', 'NONCE'],
  },
  {
    id: 'helpful-agent',
    title: 'Helpful Agent',
    summary: '도구를 사용하는 에이전트가 권한 경계를 넘지 않게 만드세요.',
    category: 'ai',
    points: 350,
    solves: 11,
    difficulty: 'INTERMEDIATE',
    tags: ['AGENT', 'PROMPT'],
  },
  {
    id: 'vault-47',
    title: 'Vault #47',
    summary: '금고 컨트랙트의 회계 불변식을 무너뜨려 자산을 회수하세요.',
    category: 'web3',
    points: 450,
    solves: 6,
    difficulty: 'ADVANCED',
    tags: ['SOLIDITY', 'DEFI'],
  },
  {
    id: 'dead-drop',
    title: 'Dead Drop',
    summary: '흩어진 단서와 메타데이터를 연결해 마지막 좌표를 찾으세요.',
    category: 'misc',
    points: 150,
    solves: 51,
    difficulty: 'BEGINNER',
    solved: true,
    tags: ['OSINT', 'FORENSICS'],
  },
];

export const leaderboard = [
  { rank: 1, name: '0xKNOCK', score: 4820, solved: 17 },
  { rank: 2, name: 'sudoers', score: 4510, solved: 16 },
  { rank: 3, name: 'packet_punks', score: 4180, solved: 15 },
  { rank: 4, name: 'segfriends', score: 3860, solved: 14 },
  { rank: 5, name: 'nullroute', score: 3410, solved: 13 },
];
