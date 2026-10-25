import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { formatActor, recordServerLog } from '@/lib/admin-logs';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, getClientAddress } from '@/lib/rate-limit';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 12,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: 'email', label: 'Email' },
        password: { type: 'password', label: 'Password' },
      },
      async authorize(rawCredentials, request) {
        const clientAddress = getClientAddress(request.headers);
        const rawEmail = typeof rawCredentials?.email === 'string' ? rawCredentials.email.trim().toLowerCase() : 'unknown';
        const limit = consumeRateLimit(`login:${clientAddress}`, 10, 10 * 60_000);
        if (!limit.allowed) {
          recordServerLog({
            level: 'WARN',
            source: 'AUTH',
            action: 'AUTH_RATE_LIMIT',
            actor: rawEmail,
            request,
            path: '/api/auth/callback/credentials',
            statusCode: 429,
            message: `로그인 시도 속도 제한 초과 (Brute-force 차단): email=${rawEmail}`,
            params: {
              attemptedEmail: rawEmail,
              resetAt: new Date(limit.resetAt).toISOString(),
            },
          });
          return null;
        }

        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          recordServerLog({
            level: 'WARN',
            source: 'AUTH',
            action: 'AUTH_INVALID_FORMAT',
            actor: rawEmail,
            request,
            path: '/api/auth/callback/credentials',
            statusCode: 400,
            message: `유효하지 않은 로그인 입력 형식: email=${rawEmail}`,
            params: { attemptedEmail: rawEmail },
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            instancerId: true,
            email: true,
            username: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });

        if (!user?.isActive) {
          recordServerLog({
            level: 'WARN',
            source: 'AUTH',
            action: 'AUTH_UNKNOWN_ACCOUNT',
            actor: parsed.data.email,
            request,
            path: '/api/auth/callback/credentials',
            statusCode: 401,
            message: `존재하지 않거나 비활성화된 계정 로그인 시도: ${parsed.data.email}`,
            params: {
              attemptedEmail: parsed.data.email,
              accountExists: Boolean(user),
              isActive: user?.isActive ?? false,
            },
          });
          return null;
        }

        const actor = formatActor(user);
        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) {
          recordServerLog({
            level: 'WARN',
            source: 'AUTH',
            action: 'AUTH_WRONG_PASSWORD',
            actor,
            actorId: user.id,
            request,
            path: '/api/auth/callback/credentials',
            statusCode: 401,
            message: `로그인 실패 (비밀번호 불일치): ${actor}`,
            params: {
              userId: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            },
          });
          return null;
        }

        const now = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: now },
        });

        recordServerLog({
          id: `user-login-${user.id}-${now.toISOString()}`,
          timestamp: now,
          level: 'INFO',
          source: 'AUTH',
          action: 'AUTH_LOGIN_SUCCESS',
          actor,
          actorId: user.id,
          request,
          path: '/api/auth/callback/credentials',
          statusCode: 200,
          message: `로그인 성공 및 세션 발급: ${actor}`,
          params: {
            userId: user.id,
            instancerId: user.instancerId,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id);
      session.user.role = token.role === 'ADMIN' ? 'ADMIN' : 'USER';
      session.user.username = String(token.username);
      return session;
    },
  },
});
