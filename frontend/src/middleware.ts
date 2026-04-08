import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  // Check for auth token in cookie (basic check - real auth is client-side via Zustand)
  // This is a lightweight check; the actual JWT verification happens on the API side
  const hasAuthStorage = request.cookies.get('refreshToken');

  // For the root path, let the client handle the redirect
  if (pathname === '/') {
    return NextResponse.next();
  }

  // If no refresh token cookie, redirect to login
  // Note: This is a soft check. The client-side Zustand store handles the real auth state.
  // Users without cookies but with valid localStorage tokens will be redirected briefly.
  if (!hasAuthStorage) {
    // Don't redirect - let client-side handle it to avoid flash issues with Zustand
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
