import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {sendConfirmationEmail} from '@/lib/email';
import { createCalendarEvent } from '@/lib/google-calendar';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import { rateLimitCheck, rateLimitFail, rateLimitSuccess } from '@/lib/rate-limit';

// Define the operating hours and capacity
export const operatingHours = {
  // Sunday: 0, Monday: 1, ..., Saturday: 6
  0: {start: 12, end: 22}, // Sunday 12 PM - 10 PM
  1: {start: 11, end: 23}, // Monday 11 AM - 11 PM
  2: {start: 11, end: 23}, // Tuesday 11 AM - 11 PM
  3: {start: 11, end: 23}, // Wednesday 11 AM - 11 PM
  4: {start: 11, end: 23}, // Thursday 11 AM - 11 PM
  5: {start: 11, end: 24}, // Friday 11 AM - 12 AM
  6: {start: 12, end: 24}, // Saturday 12 PM - 12 AM
};

const MAX_BOOKINGS_PER_HOUR = 10;

// Zod schema for input validation
const reservationSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z
    .string()
    .min(7, 'Phone is required.')
    .max(20, 'Phone number is too long.')
    .regex(/^[+\d().\-\s]{7,20}$/, 'Invalid phone number.'),
  guests: z
    .number()
    .min(2, 'Minimum 2 guests.')
    .max(20, 'Maximum 20 guests.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format.'),
  restaurantSlug: z.string().min(1).optional(),
});

// Simple 6-character alphanumeric reservation code
const RESERVATION_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateReservationCode(length: number = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * RESERVATION_CODE_CHARS.length);
    code += RESERVATION_CODE_CHARS[idx];
  }
  return code;
}

/**
 * GET handler to retrieve reservations.
 * If a 'date' query parameter is provided, it returns availability for that date.
 * Otherwise, it returns all reservations for the admin dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const restaurant = searchParams.get('restaurant');

  try {
    const supabase = createServerSupabase();
    if (date) {
      const { data, error } = await supabase
        .from('reservations')
        .select('time')
        .eq('date', date);
      if (error) {
        console.error('Supabase error (availability):', error);
        return NextResponse.json({ message: 'Failed to fetch availability' }, { status: 500 });
      }
      const bookingCounts: Record<string, number> = {};
      for (const b of data ?? []) {
        const hour = (b.time as string).split(':')[0] + ':00';
        bookingCounts[hour] = (bookingCounts[hour] || 0) + 1;
      }
      const fullyBookedSlots = Object.entries(bookingCounts)
        .filter(([, count]) => count >= MAX_BOOKINGS_PER_HOUR)
        .map(([hour]) => hour);
      return NextResponse.json({ fullyBookedSlots });
    } else {
      let query = supabase
        .from('reservations')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: true });
      if (restaurant) {
        query = query.eq('restaurant', restaurant as string);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Supabase error (list):', error);
        return NextResponse.json({ message: 'Failed to fetch reservations' }, { status: 500 });
      }
      const mapped = (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        guests: r.guests,
        date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
        time: r.time,
        calendarStatus: r.calendar_status ?? undefined,
        reservationCode: (r as any).reservation_code ?? undefined,
        restaurantSlug: (r as any).restaurant ?? undefined,
      }));
      return NextResponse.json({ reservations: mapped });
    }
  } catch (error) {
    console.error('Failed to retrieve reservations:', error);
    return NextResponse.json(
      { message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}


/**
 * POST handler to create a new reservation.
 */
export async function POST(req: NextRequest) {
  try {
    // Basic per-IP rate limit to mitigate spam/abuse of reservation creation
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (req as any).ip || 'unknown';
    const rlKey = `reservation:${ip}`;
    const rlCheck = await rateLimitCheck(rlKey);
    if (rlCheck.locked) {
      const res = NextResponse.json({ message: 'Too many reservation attempts. Please wait and try again.' }, { status: 429 });
      if (rlCheck.retryAfterMs) res.headers.set('Retry-After', Math.ceil(rlCheck.retryAfterMs / 1000).toString());
      return res;
    }
    // 1. Parse and validate the request body
    const body = await req.json();
    const parsed = reservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {message: 'Invalid input.', errors: parsed.error.format()},
        {status: 400}
      );
    }
  const {name, email, phone, date, time, guests, restaurantSlug: requestedRestaurantSlug} = parsed.data as any;
    const reservationDateTime = new Date(`${date}T${time}:00`);
    const dayOfWeek = reservationDateTime.getUTCDay();
    const hour = reservationDateTime.getUTCHours();

    // 2. Check if the restaurant is open
    const hours = operatingHours[dayOfWeek as keyof typeof operatingHours];
    if (!hours || hour < hours.start || hour >= hours.end) {
      return NextResponse.json(
        {
          message:
            "We're sorry, the restaurant is closed at the selected time.",
        },
        {status: 400}
      );
    }

    const supabase = createServerSupabase();

    // 3. Determine restaurant/location slug
    // Prefer authenticated admin's restaurant (from cookie JWT), otherwise
    // use the location sent by the client (validated against Supabase),
    // falling back to a default.
    let restaurantSlug: string | undefined = undefined;
    try {
      const adminCookie = (req as any).cookies?.get?.('admin_auth')?.value || req.cookies.get('admin_auth')?.value;
      const payload = adminCookie ? await verifyToken(adminCookie) : null;
      restaurantSlug = payload?.restaurant as string | undefined;
    } catch (e) {
      // ignore verification errors and fall back
    }

    if (!restaurantSlug) {
      restaurantSlug = requestedRestaurantSlug || process.env.DEFAULT_RESTAURANT_SLUG || 'singhs';
    }

    // 4. Validate restaurant exists and apply capacity per location
    const { data: restaurantRow, error: restaurantError } = await supabase
      .from('restaurants')
      .select('slug')
      .eq('slug', restaurantSlug)
      .maybeSingle();

    if (restaurantError) {
      console.error('Supabase error (restaurant lookup):', restaurantError);
      return NextResponse.json({ message: 'Failed to verify restaurant.' }, { status: 500 });
    }

    if (!restaurantRow) {
      return NextResponse.json({ message: 'Invalid restaurant selected.' }, { status: 400 });
    }

    const { data: existing, error: countError } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('date', date)
      .eq('time', time)
      .eq('restaurant', restaurantSlug);
    if (countError) {
      console.error('Supabase error (capacity):', countError);
      return NextResponse.json({ message: 'Failed to check capacity' }, { status: 500 });
    }
    if ((existing?.length ?? 0) >= MAX_BOOKINGS_PER_HOUR) {
      return NextResponse.json(
        {
          message:
            "We're sorry, there are no tables available at the selected time.",
        },
        {status: 400}
      );
    }

    const reservationCode = generateReservationCode();

    const newReservationDB: any = {
      name,
      email,
      phone,
      guests,
      date,
      time,
      reservation_code: reservationCode,
      restaurant: restaurantSlug,
      calendar_status: 'Pending',
      calendar_event_id: null,
    };
    
    // 5. Add to Google Calendar
    try {
      const calendarEvent = await createCalendarEvent({ name, email, phone, guests, date, time, reservationCode });
      newReservationDB.calendar_status = 'Synced';
      newReservationDB.calendar_event_id = calendarEvent?.id ?? null;
      console.log("Successfully added event to Google Calendar.");
    } catch (calendarError) {
      newReservationDB.calendar_status = 'Error';
      console.error("Failed to add event to Google Calendar:", calendarError);
    }

    // 6. Save the reservation to Supabase
    const { data: inserted, error: insertError } = await supabase
      .from('reservations')
      .insert(newReservationDB)
      .select('*')
      .single();
    if (insertError) {
      console.error('Supabase error (insert):', insertError);
      await rateLimitFail(rlKey); // count as a fail (optional; comment out if you only want to penalize invalid input)
      return NextResponse.json({ message: 'Failed to save reservation' }, { status: 500 });
    }

    // 7. Send a confirmation email (currently logs to server console).
    try {
      const emailDate = typeof inserted.date === 'string'
        ? inserted.date
        : new Date(inserted.date).toISOString().split('T')[0];

      await sendConfirmationEmail({
        to: email,
        reservationDetails: {
          id: inserted.id,
          guests: inserted.guests,
          date: emailDate,
          time: inserted.time,
          reservationCode: inserted.reservation_code ?? reservationCode,
          guestName: inserted.name,
          restaurantSlug: inserted.restaurant,
        },
      });
    } catch (emailError) {
      // Don't fail the reservation if email sending has an issue
      console.error('Failed to send confirmation email:', emailError);
    }

    const mapped = inserted ? {
      id: inserted.id,
      name: inserted.name,
      email: inserted.email,
      phone: inserted.phone,
      guests: inserted.guests,
      date: typeof inserted.date === 'string' ? inserted.date : new Date(inserted.date).toISOString().split('T')[0],
      time: inserted.time,
      calendarStatus: inserted.calendar_status ?? undefined,
      reservationCode: inserted.reservation_code ?? undefined,
    } : null;
    // Success: clear rate-limit fail counters for this IP
    await rateLimitSuccess(rlKey);
    return NextResponse.json(
      {message: 'Reservation successful!', reservation: mapped},
      {status: 201}
    );
  } catch (error) {
    console.error('Reservation failed:', error);
    // Count as fail to eventually lock abusive IPs
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (req as any).ip || 'unknown';
      await rateLimitFail(`reservation:${ip}`);
    } catch (_) { /* ignore rate-limit error */ }
    return NextResponse.json(
      {message: 'An unexpected error occurred.'},
      {status: 500}
    );
  }
}

export const runtime = 'nodejs';
