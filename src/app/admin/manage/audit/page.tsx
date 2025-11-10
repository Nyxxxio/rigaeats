import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, AdminTokenPayload } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function AuditPage() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('admin_auth')?.value;
  const ok = cookie ? await verifyToken(cookie) : null;
  if (!ok) redirect('/login?next=/admin/manage/audit');

  const supabase = createServerSupabase();
  try {
    const { data, error } = await supabase
      .from('admin_audit')
      .select('id, actor_username, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('Failed to load admin audit:', error);
      return (
        <div className="p-8">
          <h2 className="text-xl mb-4">Admin Audit</h2>
          <div className="text-red-700">Failed to load audit entries. Check server logs.</div>
        </div>
      );
    }

    return (
      <div className="p-8">
        <h2 className="text-xl mb-4">Admin Audit (most recent 200)</h2>
        <a href="/admin/manage" className="underline mb-4 block">← Back to management</a>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">When</th>
                <th className="py-2">Actor</th>
                <th className="py-2">Action</th>
                <th className="py-2">Target</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 align-top">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 align-top">{r.actor_username}</td>
                  <td className="py-2 align-top">{r.action}</td>
                  <td className="py-2 align-top">{r.target_type} {r.target_id ? `(${r.target_id})` : ''}</td>
                  <td className="py-2 align-top"><pre className="whitespace-pre-wrap">{JSON.stringify(r.details || {}, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch (e) {
    console.error('Audit page error', e);
    return (
      <div className="p-8">
        <h2 className="text-xl mb-4">Admin Audit</h2>
        <div className="text-red-700">Unexpected error loading audit.</div>
      </div>
    );
  }
}
