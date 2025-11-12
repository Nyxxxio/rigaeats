import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';
import { rateLimitCheck, rateLimitFail, rateLimitSuccess } from '@/lib/rate-limit';
import { verifyPassword } from '@/lib/password';

// For security, avoid committing real credentials in source. In dev you can set
// DEV_ADMIN_USERNAME and DEV_ADMIN_PASSWORD in your local .env; in production
// ADMIN_USERNAME and ADMIN_PASSWORD_HASH (bcrypt) are required.
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    // Prefer explicit production env vars; fall back to developer-only envs when
    // running locally. Treat empty strings as unset.
    const nonEmpty = (v?: string) => (v && v.trim() !== '' ? v : undefined);
    const expectedUser = nonEmpty(process.env.ADMIN_USERNAME) ?? nonEmpty(process.env.DEV_ADMIN_USERNAME);
    const expectedPass = nonEmpty(process.env.ADMIN_PASSWORD) ?? nonEmpty(process.env.DEV_ADMIN_PASSWORD);

    // Hard requirements in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_USERNAME) {
        return NextResponse.json({ message: 'Server misconfigured: set ADMIN_USERNAME' }, { status: 500 });
      }
      if (!process.env.ADMIN_PASSWORD_HASH) {
        return NextResponse.json({ message: 'Server misconfigured: set ADMIN_PASSWORD_HASH (bcrypt)' }, { status: 500 });
      }
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (req as any).ip || 'unknown';
    const rl = await rateLimitCheck(`login:${ip}`);
    if (rl.locked) {
      const res = NextResponse.json({ message: 'Too many attempts. Try again later.' }, { status: 429 });
      if (rl.retryAfterMs) res.headers.set('Retry-After', Math.ceil(rl.retryAfterMs / 1000).toString());
      return res;
    }

    let ok = false;
    let restaurantSlug: string | undefined = undefined;

    // If Supabase is configured, prefer looking up admin users there
    try {
      const supabase = createServerSupabase();
      if (username) {
        const { data: userRow, error } = await supabase
          .from('admin_users')
          .select('username,password_hash,restaurant_slug')
          .eq('username', username)
          .single();
        if (!error && userRow) {
          restaurantSlug = userRow.restaurant_slug ?? undefined;
          ok = await verifyPassword(password, userRow.password_hash);
        }
      }
    } catch (e) {
      // Supabase not configured or admin_users table missing — fall back to env/dev method
    }

    // Fallback to env / dev values if Supabase lookup didn't authenticate
    if (!ok && username && expectedUser && username === expectedUser) {
      const hash = nonEmpty(process.env.ADMIN_PASSWORD_HASH);
      if (hash) {
        ok = await verifyPassword(password, hash);
      } else {
        ok = (process.env.NODE_ENV !== 'production') && !!expectedPass && password === expectedPass;
      }
      // when using env/dev fallback, default the restaurant slug to DEV_RESTAURANT_SLUG or 'singhs'
      restaurantSlug = process.env.DEV_RESTAURANT_SLUG ?? process.env.DEFAULT_RESTAURANT_SLUG ?? 'singhs';
    }

    if (!ok) {
  const locked = await rateLimitFail(`login:${ip}`);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[login] dev: invalid credentials. matchedUser=', username === expectedUser, 'hashSet=', !!nonEmpty(process.env.ADMIN_PASSWORD_HASH));
      }
      const res = NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      if (locked.locked && locked.retryAfterMs) res.headers.set('Retry-After', Math.ceil(locked.retryAfterMs / 1000).toString());
      return res;
    }

  // Success: reset rate limiter and issue JWT
  await rateLimitSuccess(`login:${ip}`);
  const token = await signToken({ sub: 'admin', username, restaurant: restaurantSlug });

    const res = NextResponse.json({ message: 'ok' });
    res.cookies.set('admin_auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });
    return res;
  } catch (e) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
