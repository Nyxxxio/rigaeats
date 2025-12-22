"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

export default function SinghsLoading() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 2000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(next);
      if (elapsed >= duration) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/logo.png"
          alt="Singh's logo"
          width={220}
          height={120}
          priority
          className="object-contain"
        />
        <div className="w-64 max-w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-white transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs md:text-sm text-gray-400">Preparing your experience…</p>
      </div>
    </div>
  );
}
