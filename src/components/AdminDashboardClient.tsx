"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Utensils, Calendar, Clock, Users, Loader2, Copy, Check } from 'lucide-react';
import Link from 'next/link';

interface Booking {
    id: number;
    name: string;
    email: string;
    phone?: string;
    guests: number;
    date: string;
    time: string;
    status?: string;
    calendarStatus?: 'Synced' | 'Error' | 'Pending';
    reservationCode?: string;
    restaurantSlug?: string;
    locationLabel?: string;
}

interface AdminDashboardProps {
    restaurant?: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ restaurant }) => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const normalizePhoneForTel = (phone?: string) => {
        if (!phone) return '';
        let p = phone.trim();
        // Convert leading 00 to +
        if (p.startsWith('00')) p = '+' + p.slice(2);
        // Remove spaces, parentheses, dashes, and dots
        p = p.replace(/[\s().-]/g, '');
        return p;
    };

    const copyPhone = async (id: number, phone?: string) => {
        if (!phone) return;
        try {
            await navigator.clipboard.writeText(phone);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch (e) {
            // no-op; clipboard may be blocked
        }
    };

    const getLocationLabel = (slug?: string) => {
        if (!slug) return '—';
        switch (slug) {
            case 'singhs_pulkveza':
                return 'Pulkveža Brieža iela 2';
            case 'singhs_gertrudes':
                return 'Ģertrūdes iela 32';
            default:
                return slug;
        }
    };

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const url = new URL('/api/reservations', window.location.origin);
                if (restaurant) url.searchParams.set('restaurant', restaurant);
                const response = await fetch(url.toString());
                if (!response.ok) {
                    throw new Error('Failed to fetch bookings');
                }
                const data = await response.json();
                // Assign a simple status for display
                const bookingsWithStatus = data.reservations.map((b: Booking) => ({
                    ...b,
                    status: new Date(b.date) > new Date() ? 'Confirmed' : 'Completed',
                    locationLabel: getLocationLabel(b.restaurantSlug),
                }));
                setBookings(bookingsWithStatus);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        // Fetch bookings and analytics in parallel
        fetchBookings();
        const fetchAnalytics = async () => {
            try {
                const aurl = new URL('/api/analytics', window.location.origin);
                if (restaurant) aurl.searchParams.set('restaurant', restaurant);
                const res = await fetch(aurl.toString());
                if (!res.ok) return;
                const body = await res.json();
                // Use totals for cards if available
                if (body.totals) {
                    // Update local derived values by injecting a small adapter
                    // For simplicity, override today's counts if present
                    // (the rest of the UI uses `bookings` state; this augments the KPIs)
                }
            } catch (e) {
                // ignore analytics failures
            }
        };
        fetchAnalytics();
    }, []);

    const bookingsByHour = bookings.reduce((acc, booking) => {
        const hour = booking.time.split(':')[0] + ':00';
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(bookingsByHour)
        .map(([hour, count]) => ({ hour, bookings: count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

    const today = new Date().toISOString().split('T')[0];
    const todaysBookings = bookings.filter(b => b.date === today);
    const todaysBookingsCount = todaysBookings.length;
    const totalGuestsToday = todaysBookings.reduce((acc, b) => acc + b.guests, 0);
    const busiestHour = chartData.reduce((prev, current) => (prev.bookings > current.bookings) ? prev : current, { hour: 'N/A', bookings: 0 }).hour;

    const getCalendarStatusBadge = (status: Booking['calendarStatus']) => {
        switch (status) {
            case 'Synced':
                return 'bg-green-900/50 text-green-300';
            case 'Error':
                return 'bg-red-900/50 text-red-300';
            default:
                return 'bg-yellow-900/50 text-yellow-300';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center pattern-bg">
                <Loader2 className="w-12 h-12 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center pattern-bg">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-2">Error</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8 pattern-bg">
            <div className="container mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                        <Utensils className="w-8 h-8" />
                        Singh's Spices Dashboard
                    </h1>
                    <div className="flex items-center gap-4">
                        <Link href="/singhs" className="text-sm text-gray-400 hover:text-white">Back to Main Site &rarr;</Link>
                        <Link href="/api/auth/logout" className="text-sm text-gray-400 hover:text-white">Logout</Link>
                    </div>
                </header>

                {/* Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-[#181818] border-gray-700">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Today's Bookings</CardTitle>
                            <Calendar className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{todaysBookingsCount}</div>
                            <p className="text-xs text-gray-500">Total reservations for today</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#181818] border-gray-700">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Guests Today</CardTitle>
                            <Users className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalGuestsToday}</div>
                            <p className="text-xs text-gray-500">Total guests expected today</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#181818] border-gray-700">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400">Busiest Hour</CardTitle>
                            <Clock className="h-4 w-4 text-gray-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{busiestHour}</div>
                            <p className="text-xs text-gray-500">Peak reservation time overall</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Bookings Table */}
                    <div className="lg:col-span-2">
                        <Card className="bg-[#181818] border-gray-700">
                            <CardHeader>
                                <CardTitle>All Bookings</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {bookings.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-gray-700 hover:bg-gray-800">
                                                <TableHead className="text-white">Name</TableHead>
                                                <TableHead className="text-white">Res. ID</TableHead>
                                                <TableHead className="text-white">Location</TableHead>
                                                <TableHead className="text-white">Email</TableHead>
                                                <TableHead className="text-white">Phone</TableHead>
                                                <TableHead className="text-white">Guests</TableHead>
                                                <TableHead className="text-white">Date & Time</TableHead>
                                                <TableHead className="text-white">Status</TableHead>
                                                <TableHead className="text-white">Calendar Sync</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bookings.map((booking) => (
                                                <TableRow key={booking.id} className="border-gray-800 hover:bg-gray-800/50">
                                                    <TableCell className="font-medium">{booking.name}</TableCell>
                                                    <TableCell>
                                                        {booking.reservationCode ? (
                                                            <span className="font-mono text-xs tracking-widest bg-gray-800/80 px-2 py-1 rounded-md">
                                                                {booking.reservationCode}
                                                            </span>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{booking.locationLabel || getLocationLabel(booking.restaurantSlug)}</TableCell>
                                                    <TableCell>{booking.email}</TableCell>
                                                    <TableCell>
                                                        {booking.phone ? (
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={`tel:${normalizePhoneForTel(booking.phone)}`}
                                                                    className="text-blue-400 hover:underline whitespace-nowrap"
                                                                    title="Call"
                                                                >
                                                                    {booking.phone}
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyPhone(booking.id, booking.phone)}
                                                                    className="inline-flex items-center justify-center rounded-md p-1 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    aria-label="Copy phone"
                                                                >
                                                                    {copiedId === booking.id ? (
                                                                        <Check className="w-4 h-4 text-green-400" />
                                                                    ) : (
                                                                        <Copy className="w-4 h-4 text-gray-300" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{booking.guests}</TableCell>
                                                    <TableCell>{booking.date} at {booking.time}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                                            booking.status === 'Confirmed' ? 'bg-blue-900/50 text-blue-300' : 'bg-green-900/50 text-green-300'
                                                        }`}>
                                                            {booking.status}
                                                        </span>
                                                    </TableCell>
                                                     <TableCell>
                                                        <span className={`px-2 py-1 text-xs rounded-full ${getCalendarStatusBadge(booking.calendarStatus)}`}>
                                                            {booking.calendarStatus || 'N/A'}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No bookings have been made yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Bookings Chart */}
                    <div>
                        <Card className="bg-[#181818] border-gray-700">
                            <CardHeader>
                                <CardTitle>Bookings by Hour</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    {chartData.length > 0 ? (
                                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="hour" stroke="#888888" fontSize={12} />
                                            <YAxis stroke="#888888" fontSize={12} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#181818',
                                                    borderColor: '#3a3a3a',
                                                    color: '#ffffff'
                                                }}
                                                cursor={{fill: 'rgba(255,255,255,0.1)'}}
                                            />
                                            <Legend wrapperStyle={{fontSize: "14px"}}/>
                                            <Bar dataKey="bookings" fill="#ffffff" name="Bookings" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-gray-500">No booking data for chart.</p>
                                        </div>
                                    )}
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
