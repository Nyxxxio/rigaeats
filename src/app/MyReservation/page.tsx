"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';

const locations = [
  {
    slug: 'singhs_pulkveza',
    label: "Pulkveža Brieža iela 2, Centra rajons, Rīga",
  },
  {
    slug: 'singhs_gertrudes',
    label: "Ģertrūdes iela 32, Centra rajons, Rīga",
  },
];

export default function MyReservationPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [reservation, setReservation] = useState<any | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>();
  const [editingTime, setEditingTime] = useState('');
  const [editingGuests, setEditingGuests] = useState<number>(2);
  const [editingPhone, setEditingPhone] = useState('');
  const [editingLocation, setEditingLocation] = useState<string>('singhs_pulkveza');
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const performLookup = async (lookupCode: string) => {
    if (!lookupCode.trim()) {
      toast({ variant: 'destructive', title: 'Missing code', description: 'Please enter your reservation ID.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/my-reservation?code=${encodeURIComponent(lookupCode.trim())}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to find reservation.');
      }
      setReservation(body.reservation);
      const d = new Date(body.reservation.date + 'T00:00:00');
      setEditingDate(d);
      setEditingTime(body.reservation.time);
      setEditingGuests(body.reservation.guests);
      setEditingPhone(body.reservation.phone || '');
      setEditingLocation(body.reservation.restaurantSlug || 'singhs_pulkveza');
    } catch (e: any) {
      setReservation(null);
      toast({ variant: 'destructive', title: 'Lookup failed', description: e.message || 'Could not find reservation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    await performLookup(code);
  };

  useEffect(() => {
    const initialCode = searchParams.get('code');
    if (initialCode) {
      const normalized = initialCode.toUpperCase();
      setCode(normalized);
      performLookup(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleUpdate = async () => {
    if (!reservation) return;
    setLoading(true);
    try {
      const res = await fetch('/api/my-reservation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationCode: reservation.reservationCode,
          date: editingDate ? format(editingDate, 'yyyy-MM-dd') : reservation.date,
          time: editingTime,
          guests: editingGuests,
          phone: editingPhone,
          restaurantSlug: editingLocation,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to update reservation.');
      }
      setReservation(body.reservation);
      toast({ title: 'Reservation updated', description: 'Your reservation changes have been saved.' });
      setShowUpdatePopup(true);
      setTimeout(() => {
        setShowUpdatePopup(false);
        setReservation(null);
        setCode('');
      }, 7000);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: e.message || 'Could not update reservation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/my-reservation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationCode: reservation.reservationCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Failed to cancel reservation.');
      }
      setReservation(null);
      toast({ title: 'Reservation cancelled', description: 'Your reservation has been cancelled.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Cancellation failed', description: e.message || 'Could not cancel reservation.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#181818] text-white flex items-center justify-center px-4 relative">
      <div className="w-full max-w-xl bg-[#111111] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl shadow-black/40">
        <h1 className="text-2xl md:text-3xl font-display mb-4 text-center">Manage Your Reservation</h1>
        <p className="text-gray-400 text-sm md:text-base mb-6 text-center">
          Enter your Reservation ID to view, update, or cancel your booking.
        </p>
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Enter Reservation ID"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="bg-[#2a2a2a] border-gray-700 uppercase tracking-[0.25em] text-center"
            maxLength={6}
          />
          <Button onClick={handleLookup} disabled={loading} className="whitespace-nowrap">
            {loading ? 'Loading...' : 'Find'}
          </Button>
        </div>

        {reservation && (
          <div className="space-y-4 mt-4">
            <div className="text-sm text-gray-300">
              <p><span className="font-semibold">Name:</span> {reservation.name}</p>
              <p><span className="font-semibold">Email:</span> {reservation.email}</p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                {reservation.calendarStatus === 'Synced' ? 'Confirmed' : 'Not confirmed'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Date</p>
                <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-[#2a2a2a] border-gray-700 text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editingDate ? format(editingDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#181818] border-gray-700">
                    <Calendar
                      mode="single"
                      selected={editingDate}
                      onSelect={setEditingDate}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Time (HH:MM)</p>
                <Input
                  value={editingTime}
                  onChange={(e) => setEditingTime(e.target.value)}
                  className="bg-[#2a2a2a] border-gray-700"
                  placeholder="19:00"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Guests</p>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={editingGuests}
                  onChange={(e) => setEditingGuests(parseInt(e.target.value || '1', 10))}
                  className="bg-[#2a2a2a] border-gray-700"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Phone</p>
                <Input
                  value={editingPhone}
                  onChange={(e) => setEditingPhone(e.target.value)}
                  className="bg-[#2a2a2a] border-gray-700"
                  placeholder="(+371) 6331-1909"
                />
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-400 mb-1">Location</p>
                <Select value={editingLocation} onValueChange={setEditingLocation}>
                  <SelectTrigger className="w-full bg-[#2a2a2a] border-gray-700">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] text-white border-gray-700">
                    {locations.map((loc) => (
                      <SelectItem key={loc.slug} value={loc.slug}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <Button className="flex-1" onClick={handleUpdate} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel Reservation
              </Button>
            </div>
          </div>
        )}

        {showUpdatePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-[#111111] border border-gray-800 rounded-2xl px-8 py-10 max-w-lg w-[90%] text-center shadow-2xl shadow-black/60">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Reservation Is Updated</h2>
              <p className="text-gray-300 text-sm md:text-base">
                Your request has been handled, Thank you for letting us know.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
