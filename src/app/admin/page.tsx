import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, AdminTokenPayload } from '@/lib/auth';
import AdminDashboard from '@/components/AdminDashboardClient';

export default async function Page() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('admin_auth')?.value;
  const ok = cookie ? await verifyToken(cookie) : null;
  if (!ok) {
    redirect(`/login?next=/admin`);
  }
  const payload = ok as AdminTokenPayload;
  const restaurant = payload.restaurant ?? process.env.DEFAULT_RESTAURANT_SLUG ?? 'singhs';
  return <AdminDashboard restaurant={restaurant} />;
}
