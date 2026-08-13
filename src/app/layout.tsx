import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// The wordmark on the page is just "Archive". Tabs and search results get the
// longer form, since one generic word is unfindable and indistinguishable there.
const TITLE = 'Archive — military hardware, in person';
const DESCRIPTION =
  'Photos of tanks, ships, submarines, aircraft and artillery, taken where they sit.';

export const metadata: Metadata = {
  title: {
    default:  TITLE,
    template: '%s | Archive',
  },
  description: DESCRIPTION,
  openGraph: {
    title:       TITLE,
    description: DESCRIPTION,
    type:        'website',
    siteName:    'Archive',
  },
  twitter: {
    card:        'summary_large_image',
    title:       TITLE,
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
