

"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Menu as MenuIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import placeholderData from '@/lib/placeholder-images.json';
import { menuData } from '@/lib/menu-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';

const operatingHours = {
  // Sunday: 0, Monday: 1, ..., Saturday: 6
  0: { start: 12, end: 22 }, // Sunday 12 PM - 10 PM
  1: { start: 11, end: 23 }, // Monday 11 AM - 11 PM
  2: { start: 11, end: 23 }, // Tuesday 11 AM - 11 PM
  3: { start: 11, end: 23 }, // Wednesday 11 AM - 11 PM
  4: { start: 11, end: 23 }, // Thursday 11 AM - 11 PM
  5: { start: 11, end: 24 }, // Friday 11 AM - 12 AM
  6: { start: 12, end: 24 }, // Saturday 12 PM - 12 AM
};

const generateTimeSlots = (day: number) => {
    const hours = operatingHours[day as keyof typeof operatingHours];
    if (!hours) return [];

    const slots = [];
    // The end hour is exclusive in the loop, so we use <= end-1 or < end
    for (let hour = hours.start; hour < hours.end; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
};

const Page = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [guests, setGuests] = useState('2');
  const [time, setTime] = useState('19:00');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [fullyBookedSlots, setFullyBookedSlots] = useState<string[]>([]);
  
  const { toast } = useToast();
  
  useEffect(() => {
    const selectedDate = date || new Date();
    const dayOfWeek = selectedDate.getDay();
    const allPossibleTimes = generateTimeSlots(dayOfWeek);

    const fetchAvailability = async () => {
        if (!date) return;
        const dateString = format(date, 'yyyy-MM-dd');
        try {
            const response = await fetch(`/api/reservations?date=${dateString}`);
            if (response.ok) {
                const data = await response.json();
                setFullyBookedSlots(data.fullyBookedSlots || []);
            }
        } catch (error) {
            console.error("Failed to fetch availability", error);
            setFullyBookedSlots([]);
        }
    };

    fetchAvailability();

    const filteredTimes = allPossibleTimes.filter(
        (t) => !fullyBookedSlots.includes(t)
    );
    
    setAvailableTimes(filteredTimes);

    // Reset time if current time is not in the new list of available times
    if (!filteredTimes.includes(time)) {
        setTime(filteredTimes[0] || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fullyBookedSlots.length]);


  const getImage = (id: string) => {
    return placeholderData.placeholderImages.find(img => img.id === id);
  }

  const heroImage = getImage('hero');

  const openModal = () => {
    setIsSubmitted(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!name || !email || !phone || !date || !time || !guests) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill out all fields (including phone) to make a reservation.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          guests: parseInt(guests, 10),
          date: format(date || new Date(), 'yyyy-MM-dd'),
          time,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to make reservation.');
      }

      // Refetch availability after successful booking
      const dateString = format(date, 'yyyy-MM-dd');
      const availabilityResponse = await fetch(`/api/reservations?date=${dateString}`);
      if (availabilityResponse.ok) {
          const data = await availabilityResponse.json();
          setFullyBookedSlots(data.fullyBookedSlots || []);
      }

      setIsSubmitted(true);
      setTimeout(() => {
        closeModal();
      }, 5000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: error.message || 'Could not process your reservation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 p-6 md:p-8">
          <div className="container mx-auto flex justify-between items-center">
            <a href="#" className="flex items-center gap-3">
              {/* Prefer a user-provided /public/logo.png or NEXT_PUBLIC_LOGO_PATH; fall back to logo.svg on error */}
              <img
                src={process.env.NEXT_PUBLIC_LOGO_PATH ?? '/logo.png'}
                alt="Singh's"
                width={160}
                height={40}
                className="object-contain"
                onError={(e) => {
                  try {
                    (e.currentTarget as HTMLImageElement).src = '/logo.svg';
                  } catch (_) {}
                }}
              />
              <span className="sr-only">Singh's</span>
            </a>
            <div className="flex items-center space-x-8">
              <nav className="hidden md:flex space-x-8">
                <a
                  href="#menu"
                  className="text-white hover:text-gray-300 transition-colors duration-300"
                >
                  Menu
                </a>
                <a
                  href="#about"
                  className="text-white hover:text-gray-300 transition-colors duration-300"
                >
                  Our Story
                </a>
                <a
                  href="#contact"
                  className="text-white hover:text-gray-300 transition-colors duration-300"
                >
                  Contact
                </a>
              </nav>
              <Button
                onClick={openModal}
                variant="outline"
                className="hidden md:inline-block rounded-full text-white border-white hover:bg-white hover:text-black"
              >
                Reserve a Table
              </Button>
               <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                            <MenuIcon />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="bg-[#181818] border-gray-700 text-white">
                        <div className="flex flex-col space-y-6 pt-12">
                            <SheetClose asChild>
                                <a href="#menu" className="text-lg hover:text-gray-300">Menu</a>
                            </SheetClose>
                            <SheetClose asChild>
                                <a href="#about" className="text-lg hover:text-gray-300">Our Story</a>
                            </SheetClose>
                            <SheetClose asChild>
                                <a href="#contact" className="text-lg hover:text-gray-300">Contact</a>
                            </SheetClose>
                            <SheetClose asChild>
                                <Button onClick={openModal} variant="outline" className="w-full rounded-full text-white border-white hover:bg-white hover:text-black">
                                    Reserve a Table
                                </Button>
                            </SheetClose>
                        </div>
                    </SheetContent>
                </Sheet>
              </div>
              <a
                href="https://rigaeats.com"
                target="_blank"
                className="text-xs text-gray-400 hover:text-white hidden lg:block border-l border-gray-700 pl-8"
              >
                Part of <span className="font-bold">RigaEats</span>
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="relative z-10 pattern-bg">
           <section className="min-h-screen container mx-auto flex flex-col justify-center items-center px-6">
            <div className="text-center">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold text-white leading-tight mb-8">
                The Best Indian Restaurant in Riga
              </h1>
              <Button
                  onClick={openModal}
                  size="lg"
                  className="rounded-full bg-white text-black hover:bg-gray-200 transform hover:scale-105 mt-16"
              >
                  Book Your Experience
              </Button>
            </div>
          </section>
        </main>
        
        <div className="absolute inset-0 z-0">
          {heroImage && (
            <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              fill
              className="object-cover grayscale"
              priority
              data-ai-hint={heroImage.imageHint}
            />
          )}
          <div className="absolute inset-0 bg-black/60"></div>
        </div>
      </div>


      {/* The rest of the page content */}
      <div className="bg-[#1C1C1C]">
        {/* About Section */}
        <section id="about" className="py-10 md:py-16 bg-[#181818]">
          <div className="container mx-auto px-6 text-center max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-display text-white mb-6">
              Our Story
            </h2>
            <p className="text-gray-400 leading-relaxed">
              At Singh's, we believe that food is more than sustenance—it's an
              experience. Founded on the principles of authenticity and
              innovation, our kitchen is a playground where traditional spices
              meet modern culinary techniques. Every dish is crafted with
              passion, precision, and a deep respect for our heritage, designed
              to delight your senses and create lasting memories.
            </p>
          </div>
        </section>

        {/* Menu Section */}
        <section id="menu" className="w-full py-10 md:py-16 relative overflow-hidden">
          <div className="absolute -top-12 -left-12 opacity-10 text-white pointer-events-none">
             <svg width="200" height="200" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5C12 2.5 5 2.5 2.5 8C2.5 13.5 12 21.5 12 21.5C12 21.5 21.5 13.5 21.5 8C19 2.5 12 2.5 12 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M14.5 9.5C14.5 10.8807 13.3807 12 12 12C10.6193 12 9.5 10.8807 9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5Z" stroke="currentColor" strokeWidth="1.5"></path><path d="M12 2.5C12 2.5 13.25 5.5 16.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M12 2.5C12 2.5 10.75 5.5 7.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M2.5 8C2.5 8 5.5 10.75 6.5 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M21.5 8C21.5 8 18.5 10.75 17.5 14" stroke="currentColor" strokeWidth="1.s" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </div>
          <div className="absolute -bottom-12 -right-12 opacity-10 text-white pointer-events-none transform rotate-180">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5C12 2.5 5 2.5 2.5 8C2.5 13.5 12 21.5 12 21.5C12 21.5 21.5 13.5 21.5 8C19 2.5 12 2.5 12 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M14.5 9.5C14.5 10.8807 13.3807 12 12 12C10.6193 12 9.5 10.8807 9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5Z" stroke="currentColor" strokeWidth="1.5"></path><path d="M12 2.5C12 2.5 13.25 5.5 16.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M12 2.5C12 2.5 10.75 5.5 7.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M2.5 8C2.5 8 5.5 10.75 6.5 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M21.5 8C21.5 8 18.5 10.75 17.5 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </div>
          <div className="container mx-auto text-center px-4 md:px-6">
            <h2 className="text-4xl md:text-5xl font-display text-white mb-12">
              Our Menu
            </h2>
          </div>
          <div className="w-full">
            <Carousel
              opts={{
                align: 'start',
              }}
              className="w-full px-4 sm:px-6 lg:px-8"
            >
              <CarouselContent>
                {menuData.map((category, index) => (
                  <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                    <div className="p-1 h-full">
                      <Card className="bg-[#181818] border-gray-700 h-full flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-24 h-24 opacity-10 text-white pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" >
                                <use href={`#card-design-${index % 4}`} />
                            </svg>
                        </div>
                         <div className="absolute bottom-0 right-0 w-24 h-24 opacity-10 text-white pointer-events-none transform rotate-180">
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" >
                                <use href={`#card-design-${index % 4}`} />
                            </svg>
                        </div>
                        <CardHeader>
                          <CardTitle className="font-display text-3xl text-white">{category.category}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-4">
                          {category.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="text-left">
                              <div className="flex justify-between items-baseline">
                                <h4 className="text-lg font-headline text-white">{item.name} <span className="text-lg font-hindi text-gray-400">{item.hindiName}</span></h4>
                              </div>
                              <p className="text-sm text-gray-400">{item.description}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="text-white bg-black/50 border-gray-600 hover:bg-white/10 ml-20" />
              <CarouselNext className="text-white bg-black/50 border-gray-600 hover:bg-white/10 mr-20" />
            </Carousel>
          </div>
        </section>

        {/* Booking Section */}
        <section id="booking" className="py-10 md:py-16 bg-[#181818]">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-display text-white mb-4">
              Reserve Your Table
            </h2>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              Experience the art of Indian dining. Check availability and book
              your table instantly.
            </p>
            <Button
              onClick={openModal}
              size="lg"
              className="rounded-full bg-white text-black hover:bg-gray-200 transform hover:scale-105"
            >
              Find a Table
            </Button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer id="contact" className="bg-black py-12">
        <div className="container mx-auto px-6 text-center text-gray-500">
          <p className="text-lg font-display text-gray-300 mb-2">SINGH'S</p>
          <p>Pulkveža Brieža iela 2, Centra rajons, Rīga, LV-1010</p>
          <p>(371) 6331-1909</p>
          <div className="flex justify-center space-x-6 mt-6">
            <a href="https://www.instagram.com/singhs_restaurant?utm_source=our_website&igsh=ZDNlZDc0MzIxNw==" className="hover:text-white transition-colors">
              Instagram
            </a>
            <a href="https://www.facebook.com/Singhsrestaurantandbar?utm_source=our_website" className="hover:text-white transition-colors">
              Facebook
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Yelp
            </a>
          </div>
          <p className="mt-8 text-sm">
            Proudly featured on{' '}
            <a
              href="https://rigaeats.com"
              target="_blank"
              className="font-semibold text-gray-400 hover:text-white"
            >
              RigaEats
            </a>
          </p>
          {/* Admin link intentionally hidden on public site */}
          <p className="mt-2 text-sm text-gray-600">
            &copy; 2024 Singh's. All Rights Reserved.
          </p>
        </div>
      </footer>

      {/* Reservation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#181818] border-gray-700 text-white rounded-2xl">
          {!isSubmitted ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-3xl md:text-4xl font-display text-white text-center">
                  Reserve a Table
                </DialogTitle>
                <DialogDescription className="text-center text-gray-400">
                  Powered by RigaEats
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-400">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[#2a2a2a] border-gray-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-400">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#2a2a2a] border-gray-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-400">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+371 2000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-[#2a2a2a] border-gray-600"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="guests" className="text-gray-400">
                      Guests
                    </Label>
                    <Select
                      name="guests"
                      value={guests}
                      onValueChange={setGuests}
                    >
                      <SelectTrigger className="w-full bg-[#2a2a2a] border-gray-600">
                        <SelectValue placeholder="Select number of guests" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#181818] text-white border-gray-600">
                        <SelectItem value="1">1 person</SelectItem>
                        <SelectItem value="2">2 people</SelectItem>
                        <SelectItem value="3">3 people</SelectItem>
                        <SelectItem value="4">4 people</SelectItem>
                        <SelectItem value="5">5 people</SelectItem>
                        <SelectItem value="6">6 people</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-gray-400">
                      Date
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant={'outline'}
                          className={cn(
                            'w-full justify-start text-left font-normal bg-[#2a2a2a] border-gray-600 hover:bg-[#3a3a3a] hover:text-white',
                            !date && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#181818] border-gray-700">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          initialFocus
                          className="text-white"
                          disabled={{ before: new Date() }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-gray-400">
                    Time
                  </Label>
                  <Select name="time" value={time} onValueChange={setTime}>
                    <SelectTrigger className="w-full bg-[#2a2a2a] border-gray-600">
                      <SelectValue placeholder="Select a time" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#181818] text-white border-gray-600">
                      {availableTimes.length > 0 ? (
                        availableTimes.map((hour) => (
                            <SelectItem key={hour} value={hour}>
                                {hour}
                            </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-slots" disabled>
                          No available slots for this day
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    className="w-full rounded-full bg-white text-black hover:bg-gray-200"
                    disabled={isSubmitting || availableTimes.length === 0}
                  >
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isSubmitting
                      ? 'Confirming...'
                      : 'Confirm Reservation'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <div className="text-center py-8">
              <h2 className="text-3xl font-display text-white mb-4">
                Thank You!
              </h2>
              <p className="text-gray-300">
                Your table is reserved. A confirmation has been sent to you via
                RigaEats. We look forward to welcoming you to Singh's.
              </p>
              <p className="text-sm text-gray-500 mt-6">
                This window will close automatically.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <svg width="0" height="0" className="absolute">
        <defs>
            <g id="card-design-0" stroke="currentColor" strokeWidth="2">
                <path d="M 20 0 H 100 V 20 L 80 40 V 100 H 60 L 40 80 H 0 V 60 Z" fill="none" />
            </g>
            <g id="card-design-1" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M0 20C0 8.95 8.95 0 20 0h80v20h-20c-11.05 0-20 8.95-20 20v60H40V60c0-11.05-8.95-20-20-20H0V20z" />
            </g>
            <g id="card-design-2" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M100 80 C100 91.05 91.05 100 80 100 H 0 V 80 H 20 C 31.05 80 40 71.05 40 60 V 0 h 20 v 40 c0 11.05 8.95 20 20 20 h 20 v 20z" />
            </g>
            <g id="card-design-3" stroke="currentColor" strokeWidth="2" fill="none">
                <circle cx="20" cy="20" r="15" />
                <path d="M20 0 V 5 M20 35 V 40 M0 20 H 5 M35 20 H 40" />
                <path d="M80 60 h20 v20 h-20 z M 60 80 h20 v20 h-20 z" />
            </g>
        </defs>
      </svg>
    </>
  );
};

export default Page;
    

    

    

    
