import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { validateEnv } from '@/lib/env-check';

// Run a quick env validation at import time so missing production secrets
// cause an early, clear failure instead of subtle runtime errors.
validateEnv();

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow auth routes, static, and API endpoints except admin-specific if any
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api') && !pathname.startsWith('/api/admin') ||
    pathname === '/' ||
    pathname.startsWith('/singhs') ||
    pathname.startsWith('/login')
  ) {
    // Continue, but we handle login redirect logic below
  } else if (pathname.startsWith('/admin')) {
  const cookie = req.cookies.get('admin_auth');
      const ok = cookie?.value ? await verifyToken(cookie.value) : null;
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname + (search || ''))}`;
      return NextResponse.redirect(url);
    }
  }

  // If visiting /login while already authed, redirect to next or /admin
  if (pathname.startsWith('/login')) {
    const cookie = req.cookies.get('admin_auth');
      const ok = cookie?.value ? await verifyToken(cookie.value) : null;
    if (ok) {
      const next = req.nextUrl.searchParams.get('next') || '/admin';
      const url = req.nextUrl.clone();
      url.pathname = next;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/api/:path*',
    '/',
    '/singhs',
  ],
};
