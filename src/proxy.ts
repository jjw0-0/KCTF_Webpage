import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const proxy = auth((request) => {
  const response = NextResponse.next();
  response.headers.set('X-KCTF-Actor', encodeURIComponent(request.auth?.user?.username ?? 'anonymous'));
  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|woff2?)$).*)'],
};
