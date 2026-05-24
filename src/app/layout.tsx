import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const DESCRIPTION =
  'Personal gallery of tanks, aircraft, artillery, and military vehicles photographed at museums and sites around the world.';

export const metadata: Metadata = {
  title: {
    default:  'Tank Gallery',
    template: '%s | Tank Gallery',
  },
  description: DESCRIPTION,
  openGraph: {
    title:       'Tank Gallery',
    description: DESCRIPTION,
    type:        'website',
    siteName:    'Tank Gallery',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Tank Gallery',
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0a0a] text-zinc-100">{children}</body>
    </html>
  );
}
