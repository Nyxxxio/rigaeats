import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { Inter, Playfair_Display, Hind_Siliguri } from 'next/font/google';
import Script from 'next/script';
import Head from 'next/head';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  display: 'swap',
  variable: '--font-inter',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair-display',
});

const hindSiliguri = Hind_Siliguri({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-hindi',
});

export const metadata: Metadata = {
  title: "Singh's Spices | Authentic Indian Cuisine",
  description:
    "Experience a culinary journey through the heart of India. Book your table at Singh's Spices today.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfairDisplay.variable} ${hindSiliguri.variable} !scroll-smooth`}
    >
      <Head>
        {/* Preload the primary hero images to improve perceived load time */}
        <link rel="preload" as="image" href="/images/hero-1.jpg" />
        <link rel="preload" as="image" href="/images/hero-2.jpg" />
      </Head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
        {(process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') && (
          <>
            <Script
              src="https://scripts.simpleanalyticscdn.com/latest.js"
              strategy="afterInteractive"
            />
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.simpleanalyticscdn.com/noscript.gif"
                alt=""
                referrerPolicy="no-referrer-when-downgrade"
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
