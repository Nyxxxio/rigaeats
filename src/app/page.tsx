"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Utensils } from 'lucide-react';

const RootPage = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center pattern-bg">
      <div className="container mx-auto text-center">
        <Card className="bg-[#181818] border-gray-700 inline-block max-w-md p-8">
          <CardHeader>
            <CardTitle className="flex justify-center items-center gap-4 text-4xl font-display">
              <Utensils className="w-10 h-10" />
              Welcome
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-8">
              You've reached the main portal. The restaurant experience awaits you.
            </p>
            <Link href="/singhs" passHref>
              <Button
                size="lg"
                className="rounded-full bg-white text-black hover:bg-gray-200 transform hover:scale-105"
              >
                Go to Singh's Spices
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RootPage;
