
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

type ReservationDetails = {
    name: string;
    email: string;
    phone: string;
    guests: number;
    date: string;
    time: string;
    reservationCode?: string;
};

// Function to get the Google Calendar API client
const getCalendarClient = () => {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!serviceAccountEmail || !privateKey || !calendarId) {
        console.error('Missing Google Calendar credentials in environment variables.');
        throw new Error('Missing Google Calendar credentials in environment variables.');
    }

    const auth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    return { calendar, calendarId };
};

// Function to create an event in Google Calendar
export const createCalendarEvent = async (reservation: ReservationDetails) => {
    try {
        const { calendar, calendarId } = getCalendarClient();
        const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'UTC';
        const inviteAttendees = process.env.GOOGLE_CALENDAR_INVITE_ATTENDEES === 'true';
        
        const [hour, minute] = reservation.time.split(':').map(Number);
        
        const eventStartTime = new Date(reservation.date);
        eventStartTime.setUTCHours(hour, minute, 0, 0);

        // Events are typically 1-2 hours long for a restaurant
        const eventEndTime = new Date(eventStartTime.getTime() + (60 * 60 * 1000)); // 1 hour duration

        const event: any = {
            summary: `Reservation: ${reservation.name} (${reservation.guests} guests)`,
            description: `Reservation ID: ${reservation.reservationCode ?? 'N/A'}\nReservation for ${reservation.guests} guest(s) made by ${reservation.name} (${reservation.email}).\nPhone: ${reservation.phone}`,
            start: {
                dateTime: eventStartTime.toISOString(),
                timeZone,
            },
            end: {
                dateTime: eventEndTime.toISOString(),
                timeZone,
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 24 hours before
                    { method: 'popup', minutes: 120 }, // 2 hours before
                ],
            },
        };

        // Service accounts cannot invite attendees without Domain-Wide Delegation.
        // Only include attendees if explicitly enabled and your org has DWD configured.
        if (inviteAttendees) {
            event.attendees = [{ email: reservation.email }];
        }

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event,
        });

        return response.data;
    } catch (error: any) {
        // Log detailed error info for easier troubleshooting
        const status = error?.code || error?.response?.status;
        const data = error?.response?.data;
        const reasons = Array.isArray(data?.error?.errors)
          ? data.error.errors.map((e: any) => e.reason).join(', ')
          : undefined;

        console.error('Error creating calendar event:', {
            message: error?.message || String(error),
            status,
            reasons,
            data,
        });

        // Re-throw a generic error; UI shows a friendly status
        throw new Error('Failed to create Google Calendar event.');
    }
};

export const updateCalendarEvent = async (eventId: string, reservation: ReservationDetails) => {
    try {
        const { calendar, calendarId } = getCalendarClient();
        const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'UTC';

        const [hour, minute] = reservation.time.split(':').map(Number);
        const eventStartTime = new Date(reservation.date);
        eventStartTime.setUTCHours(hour, minute, 0, 0);
        const eventEndTime = new Date(eventStartTime.getTime() + (60 * 60 * 1000));

        const event: any = {
            summary: `Reservation: ${reservation.name} (${reservation.guests} guests)`,
            description: `Reservation ID: ${reservation.reservationCode ?? 'N/A'}\nReservation for ${reservation.guests} guest(s) made by ${reservation.name} (${reservation.email}).\nPhone: ${reservation.phone}`,
            start: {
                dateTime: eventStartTime.toISOString(),
                timeZone,
            },
            end: {
                dateTime: eventEndTime.toISOString(),
                timeZone,
            },
        };

        const response = await calendar.events.update({
            calendarId,
            eventId,
            requestBody: event,
        });

        return response.data;
    } catch (error: any) {
        console.error('Error updating calendar event:', error?.message || String(error));
        throw new Error('Failed to update Google Calendar event.');
    }
};

export const cancelCalendarEvent = async (eventId: string) => {
    try {
        const { calendar, calendarId } = getCalendarClient();
        await calendar.events.delete({
            calendarId,
            eventId,
        });
    } catch (error: any) {
        console.error('Error cancelling calendar event:', error?.message || String(error));
        // Do not throw; cancellation failures should not block app flow
    }
};
