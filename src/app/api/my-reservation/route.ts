import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { operatingHours } from '@/app/api/reservations/route';
import { createCalendarEvent, updateCalendarEvent, cancelCalendarEvent } from '@/lib/google-calendar';

const updateSchema = z.object({
  reservationCode: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  guests: z.number().min(1).max(20).optional(),
  phone: z.string().min(7).max(20).optional(),
  restaurantSlug: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ message: 'Missing reservation code.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('reservation_code', code)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (lookup by code):', error);
    return NextResponse.json({ message: 'Failed to look up reservation.' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ message: 'Reservation not found.' }, { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const status = data.date >= today ? 'upcoming' : 'past';

  return NextResponse.json({
    reservation: {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      guests: data.guests,
      date: typeof data.date === 'string' ? data.date : new Date(data.date).toISOString().split('T')[0],
      time: data.time,
      restaurantSlug: data.restaurant,
      reservationCode: data.reservation_code,
      calendarStatus: data.calendar_status ?? undefined,
      status,
    },
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input.', errors: parsed.error.format() }, { status: 400 });
  }

  const { reservationCode, date, time, guests, phone, restaurantSlug } = parsed.data;

  const supabase = createServerSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from('reservations')
    .select('*')
    .eq('reservation_code', reservationCode)
    .maybeSingle();

  if (lookupError) {
    console.error('Supabase error (lookup for update):', lookupError);
    return NextResponse.json({ message: 'Failed to look up reservation.' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ message: 'Reservation not found.' }, { status: 404 });
  }

  const newDate = date ?? (typeof existing.date === 'string' ? existing.date : new Date(existing.date).toISOString().split('T')[0]);
  const newTime = time ?? existing.time;
  const newGuests = guests ?? existing.guests;
  const newPhone = phone ?? existing.phone;
  const newRestaurant = restaurantSlug ?? existing.restaurant;

  const reservationDateTime = new Date(`${newDate}T${newTime}:00`);
  const dayOfWeek = reservationDateTime.getUTCDay();
  const hour = reservationDateTime.getUTCHours();

  const hours = operatingHours[dayOfWeek as keyof typeof operatingHours];
  if (!hours || hour < hours.start || hour >= hours.end) {
    return NextResponse.json({
      message: "We're sorry, the restaurant is closed at the selected time.",
    }, { status: 400 });
  }

  const { data: capacityRows, error: capacityError } = await supabase
    .from('reservations')
    .select('id')
    .eq('date', newDate)
    .eq('time', newTime)
    .eq('restaurant', newRestaurant)
    .neq('id', existing.id);

  if (capacityError) {
    console.error('Supabase error (capacity check for update):', capacityError);
    return NextResponse.json({ message: 'Failed to check capacity.' }, { status: 500 });
  }

  if ((capacityRows?.length ?? 0) >= 10) {
    return NextResponse.json({
      message: "We're sorry, there are no tables available at the selected time.",
    }, { status: 400 });
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('reservations')
    .update({
      date: newDate,
      time: newTime,
      guests: newGuests,
      phone: newPhone,
      restaurant: newRestaurant,
    })
    .eq('id', existing.id)
    .select('*')
    .maybeSingle();

  if (updateError) {
    console.error('Supabase error (update):', updateError);
    return NextResponse.json({ message: 'Failed to update reservation.' }, { status: 500 });
  }

  try {
    const calendarDetails = {
      name: existing.name,
      email: existing.email,
      phone: newPhone,
      guests: newGuests,
      date: newDate,
      time: newTime,
      reservationCode: existing.reservation_code,
    };

    if (existing.calendar_event_id) {
      await updateCalendarEvent(existing.calendar_event_id, calendarDetails);
      await supabase
        .from('reservations')
        .update({ calendar_status: 'Synced' })
        .eq('id', existing.id);
    } else {
      const created = await createCalendarEvent(calendarDetails);
      await supabase
        .from('reservations')
        .update({ calendar_status: 'Synced', calendar_event_id: created?.id ?? null })
        .eq('id', existing.id);
    }
  } catch (e) {
    console.error('Failed to sync update to Google Calendar:', e);
    await supabase
      .from('reservations')
      .update({ calendar_status: 'Error' })
      .eq('id', existing.id);
  }

  return NextResponse.json({ message: 'Reservation updated.', reservation: updatedRows });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = body.reservationCode as string | undefined;

  if (!code) {
    return NextResponse.json({ message: 'Missing reservation code.' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: existing, error: lookupError } = await supabase
    .from('reservations')
    .select('*')
    .eq('reservation_code', code)
    .maybeSingle();

  if (lookupError) {
    console.error('Supabase error (lookup for delete):', lookupError);
    return NextResponse.json({ message: 'Failed to look up reservation.' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ message: 'Reservation not found.' }, { status: 404 });
  }

  if (existing.calendar_event_id) {
    await cancelCalendarEvent(existing.calendar_event_id);
  }

  const { error: deleteError } = await supabase
    .from('reservations')
    .delete()
    .eq('id', existing.id);

  if (deleteError) {
    console.error('Supabase error (delete):', deleteError);
    return NextResponse.json({ message: 'Failed to cancel reservation.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Reservation cancelled.' });
}
