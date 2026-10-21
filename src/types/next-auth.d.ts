import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: 'ADMIN' | 'USER';
    username: string;
  }

  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'USER';
      username: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'USER';
    username: string;
  }
}
