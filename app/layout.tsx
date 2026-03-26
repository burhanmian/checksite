import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkyWatch — Real-Time Flight Intelligence',
  description: 'Live flight tracking, airport alerts, METARs, NOTAMs and disruption intelligence across 14,000 airports worldwide.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
