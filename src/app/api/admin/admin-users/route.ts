import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import { hashPassword } from '@/lib/password';

const bodySchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  restaurant_slug: z.string().min(1),
});

async function isAuthorized(req: NextRequest) {
  const secret = process.env.ADMIN_MANAGEMENT_SECRET;
  const header = req.headers.get('x-admin-secret');
  if (secret && header && header === secret) return true;
  // Fallback to admin auth cookie
  try {
    const cookie = req.cookies.get('admin_auth')?.value;
    if (!cookie) return false;
    const payload = await verifyToken(cookie);
    return !!payload;
  } catch (_) {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const supabase = createServerSupabase();
    const { username, password, restaurant_slug } = parsed.data;

    // Ensure restaurant exists
    const { data: rest } = await supabase.from('restaurants').select('slug').eq('slug', restaurant_slug).single();
    if (!rest) {
      return NextResponse.json({ message: 'Restaurant not found' }, { status: 404 });
    }

    // Check username uniqueness
    const { data: existing } = await supabase.from('admin_users').select('id').eq('username', username).single();
    if (existing) {
      return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const { error } = await supabase.from('admin_users').insert({ username, password_hash, restaurant_slug }).select();
    if (error) {
      console.error('Supabase insert admin_users error:', error);
      return NextResponse.json({ message: 'Failed to create admin user' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Admin user created', user: { username, restaurant_slug } }, { status: 201 });
  } catch (e) {
    console.error('Create admin user error:', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
