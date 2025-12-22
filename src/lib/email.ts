// @ts-ignore - nodemailer types may not be available in CI, but runtime import is valid
import nodemailer from 'nodemailer';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * @fileoverview Email sending helpers.
 * This project uses Gmail SMTP via nodemailer, configured by env vars.
 */

type ReservationDetails = {
  id: number;
  guests: number;
  date: string;
  time: string;
  reservationCode?: string;
  guestName?: string;
  restaurantSlug?: string;
};

type ConfirmationEmailPayload = {
  to: string;
  reservationDetails: ReservationDetails;
};

type RestaurantDetails = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

async function getRestaurantDetails(slug?: string): Promise<RestaurantDetails | null> {
  if (!slug) return null;
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from('restaurants')
      .select('name, address, phone')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Supabase error (restaurant lookup for email):', error);
      return null;
    }

    if (!data) return null;
    return {
      name: data.name,
      address: (data as any).address ?? null,
      phone: (data as any).phone ?? null,
    };
  } catch (e) {
    console.error('Failed to load restaurant details for email:', e);
    return null;
  }
}

/**
 * Sends a reservation confirmation email.
 *
 * @param payload - The email payload.
 */
export async function sendConfirmationEmail(payload: ConfirmationEmailPayload) {
  const { to, reservationDetails } = payload;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.error('Missing SMTP_USER or SMTP_PASS env vars; cannot send email.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  });

  const fromAddress = process.env.SMTP_FROM || 'barscoutlv@gmail.com';
  const slug = reservationDetails.restaurantSlug || process.env.DEFAULT_RESTAURANT_SLUG || 'singhs';
  const restaurant = await getRestaurantDetails(slug);

  const restaurantName =
    restaurant?.name ||
    process.env.RESTAURANT_NAME ||
    "Singh's";
  const restaurantAddress =
    restaurant?.address ||
    process.env.RESTAURANT_ADDRESS ||
    'Pulkveža Brieža iela 2, Centra rajons, Rīga, LV-1010';
  const restaurantPhone =
    restaurant?.phone ||
    process.env.RESTAURANT_PHONE ||
    '(371) 6331-1909';

  const guestName = reservationDetails.guestName || 'Guest';
  const reservationId = reservationDetails.reservationCode || String(reservationDetails.id);

  const manageBaseUrl = process.env.MY_RESERVATION_URL || 'https://rigaeats.app/MyReservation';
  const manageUrl = `${manageBaseUrl}?code=${encodeURIComponent(reservationId)}`;

  const subject = `Your table is confirmed – ${restaurantName}`;

  const html = `
    <p>Dear ${guestName},</p>

    <p>Your table is confirmed.</p>
    <p>Were delighted to let you know that your reservation has been successfully secured. We look forward to welcoming you and making your dining experience memorable.</p>

    <h3>Reservation Details</h3>
    <p><strong>Reservation ID:</strong> ${reservationId}</p>
    <p><strong>Number of Guests:</strong> ${reservationDetails.guests}</p>

    <h3>View or Modify Your Reservation</h3>
    <p>
      You can view or modify your reservation at any time using this link:
      <br/>
      <a href="${manageUrl}" target="_blank" rel="noopener noreferrer">Manage my reservation</a>
    </p>

    <h3>Restaurant Information</h3>
    <p><strong>Restaurant Name:</strong> ${restaurantName}</p>
    <p><strong>Address:</strong> ${restaurantAddress}</p>
    <p><strong>Contact Number:</strong> ${restaurantPhone}</p>

    <p>If you need to make any changes to your reservation or have special requests, please feel free to contact us. Well be happy to assist you.</p>

    <p>Thank you for choosing ${restaurantName}. We look forward to serving you soon.</p>

    <p>Warm regards,<br/>
    ${restaurantName} Team</p>
  `;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
}

/**
 * Sends a reservation reminder email.
 * This would typically be triggered by a scheduled job (e.g., a cron job)
 * that checks for upcoming reservations.
 *
 * @param payload - The email payload.
 */
export async function sendReminderEmail(payload: ConfirmationEmailPayload) {
  console.log('--- Sending Reminder Email (Placeholder) ---');
  console.log('To:', payload.to);
  console.log('Your reservation is in 2 hours!');
  console.log('Reservation:', payload.reservationDetails);
  // --- INTEGRATION WITH YOUR EMAIL PROVIDER GOES HERE ---
  console.log('--------------------------------------------');

  return Promise.resolve();
}
