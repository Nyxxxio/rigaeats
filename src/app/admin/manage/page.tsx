import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, AdminTokenPayload } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/password';

export default async function AdminManagePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
  // server component guard: require admin auth
  const cookieStore = await cookies();
  const cookie = cookieStore.get('admin_auth')?.value;
  const ok = cookie ? await verifyToken(cookie) : null;
  if (!ok) {
    redirect(`/login?next=/admin/manage`);
  }

  const sp = searchParams ? await searchParams : undefined;
  const status = Array.isArray(sp?.status) ? sp?.status[0] : sp?.status;
  const createdSlug = Array.isArray(sp?.slug) ? sp?.slug[0] : sp?.slug;
  const createdUsername = Array.isArray(sp?.username) ? sp?.username[0] : sp?.username;

  return (
    <div className="min-h-screen p-8">
      <h2 className="text-2xl mb-4">Admin Management</h2>
      {status === 'restaurant-created' && (
        <div className="mb-4 text-green-700">Restaurant "{createdSlug}" created successfully.</div>
      )}
      {status === 'admin-created' && (
        <div className="mb-4 text-green-700">Admin user "{createdUsername}" created successfully.</div>
      )}
      {status === 'error' && <div className="mb-4 text-red-700">An error occurred — check server logs.</div>}

      <form action={createRestaurant} className="mb-6" method="post">
        <h3 className="font-semibold">Create Restaurant</h3>
        <input name="slug" placeholder="slug" required />
        <input name="name" placeholder="name" required />
        <button type="submit">Create</button>
      </form>

      <form action={createAdminUser} method="post">
        <h3 className="font-semibold">Create Admin User</h3>
        <input name="username" placeholder="username" required />
        <input name="password" type="password" placeholder="password" required />
        <input name="restaurant_slug" placeholder="restaurant_slug" required />
        <button type="submit">Create Admin</button>
      </form>
    </div>
  );
}

async function requireAdmin(): Promise<AdminTokenPayload> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('admin_auth')?.value;
  const ok = cookie ? await verifyToken(cookie) : null;
  if (!ok) {
    redirect(`/login?next=/admin/manage`);
  }
  return ok as AdminTokenPayload;
}

async function createRestaurant(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get('slug') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!slug || !name) {
    redirect('/admin/manage?status=invalid');
  }

  try {
    const supabase = createServerSupabase();
    const { data: existing } = await supabase.from('restaurants').select('slug').eq('slug', slug).single();
    if (existing) {
      redirect('/admin/manage?status=exists');
    }
    const { error } = await supabase.from('restaurants').insert({ slug, name }).select();
    if (error) {
      console.error('Supabase insert restaurant error:', error);
      redirect('/admin/manage?status=error');
    }

    // Audit the action
    try {
      const actorPayload = await requireAdmin();
      const actor = actorPayload.username;
      const actorRestaurant = actorPayload.restaurant ?? null;
      await supabase.from('admin_audit').insert({ actor_username: actor, action: 'create_restaurant', target_type: 'restaurant', target_id: slug, details: { name, actor_restaurant: actorRestaurant } });
    } catch (e) {
      console.error('Failed to write audit for restaurant creation', e);
    }
  redirect(`/admin/manage?status=restaurant-created&slug=${encodeURIComponent(slug)}`);
  } catch (e) {
    console.error('Create restaurant error:', e);
    redirect('/admin/manage?status=error');
  }
}

async function createAdminUser(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const restaurant_slug = String(formData.get('restaurant_slug') ?? '').trim();
  if (!username || password.length < 8 || !restaurant_slug) {
    redirect('/admin/manage?status=invalid');
  }

  try {
    const supabase = createServerSupabase();
    // Ensure restaurant exists
    const { data: rest } = await supabase.from('restaurants').select('slug').eq('slug', restaurant_slug).single();
    if (!rest) {
      redirect('/admin/manage?status=restaurant-not-found');
    }

    // Check username uniqueness
    const { data: existing } = await supabase.from('admin_users').select('id').eq('username', username).single();
    if (existing) {
      redirect('/admin/manage?status=exists');
    }

    const password_hash = await hashPassword(password);
    const { error } = await supabase.from('admin_users').insert({ username, password_hash, restaurant_slug }).select();
    if (error) {
      console.error('Supabase insert admin_users error:', error);
      redirect('/admin/manage?status=error');
    }

    // Audit admin creation
    try {
      const actorPayload = await requireAdmin();
      const actor = actorPayload.username;
      const actorRestaurant = actorPayload.restaurant ?? null;
      await supabase.from('admin_audit').insert({ actor_username: actor, action: 'create_admin_user', target_type: 'admin_user', target_id: username, details: { restaurant_slug, actor_restaurant: actorRestaurant } });
    } catch (e) {
      console.error('Failed to write audit for admin creation', e);
    }

  redirect(`/admin/manage?status=admin-created&username=${encodeURIComponent(username)}`);
  } catch (e) {
    console.error('Create admin user error:', e);
    redirect('/admin/manage?status=error');
  }
}
