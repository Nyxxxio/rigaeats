import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

const bodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
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
    const { slug, name } = parsed.data;
    // Insert restaurant if not exists
    const { data: existing } = await supabase.from('restaurants').select('slug').eq('slug', slug).single();
    if (existing) {
      return NextResponse.json({ message: 'Restaurant already exists' }, { status: 409 });
    }
    const { error } = await supabase.from('restaurants').insert({ slug, name }).select();
    if (error) {
      console.error('Supabase insert restaurant error:', error);
      return NextResponse.json({ message: 'Failed to create restaurant' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Restaurant created', restaurant: { slug, name } }, { status: 201 });
  } catch (e) {
    console.error('Create restaurant error:', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
