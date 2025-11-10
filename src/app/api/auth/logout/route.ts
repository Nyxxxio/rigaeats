import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get('next') || '/login';
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set('admin_auth', '', { path: '/', maxAge: 0 });
  return res;
}
