import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get('restaurant');
  try {
    const supabase = createServerSupabase();
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 89); // last 90 days including today
    const startDate = toISODate(start);
    let query = supabase
      .from('reservations')
      .select('id, date, time, guests, email')
      .gte('date', startDate);
    // If the client supplied a restaurant query param, filter by it. The client should call /api/analytics?restaurant=slug
    if (restaurant) {
      query = query.eq('restaurant', restaurant);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Analytics fetch error:', error);
      return NextResponse.json({ message: 'Failed to fetch analytics' }, { status: 500 });
    }

    const rows = data ?? [] as any[];

    // Aggregate per-day and by-hour
    const daily: Record<string, { bookings: number; guests: number }> = {};
    const byHour: Record<string, number> = {};
    const uniqueEmails = new Set<string>();

    for (const r of rows) {
      const date = typeof r.date === 'string' ? r.date : toISODate(new Date(r.date));
      daily[date] = daily[date] || { bookings: 0, guests: 0 };
      daily[date].bookings += 1;
      daily[date].guests += r.guests ?? 0;
      const hour = String((r.time || '00:00').split(':')[0]).padStart(2, '0') + ':00';
      byHour[hour] = (byHour[hour] || 0) + 1;
      if (r.email) uniqueEmails.add(r.email);
    }

    // Ensure we include all dates in the range with zeros
    const dailySeries: Array<{ date: string; bookings: number; guests: number }> = [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = toISODate(d);
      const v = daily[k] || { bookings: 0, guests: 0 };
      dailySeries.push({ date: k, bookings: v.bookings, guests: v.guests });
    }

    // Totals and today
    const totals = dailySeries.reduce(
      (acc, x) => ({ bookings: acc.bookings + x.bookings, guests: acc.guests + x.guests }),
      { bookings: 0, guests: 0 }
    );
    const todayKey = toISODate(today);
    const todayStats = daily[todayKey] || { bookings: 0, guests: 0 };

    return NextResponse.json({
      window: { start: startDate, end: toISODate(today) },
      daily: dailySeries,
      byHour,
      totals: { ...totals, uniqueUsers: uniqueEmails.size },
      today: todayStats,
    });
  } catch (e) {
    console.error('Analytics error:', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
