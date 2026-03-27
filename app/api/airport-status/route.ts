// FAA NAS Status — free public API, no key needed
// Falls back to live simulation when unreachable
import { NextRequest, NextResponse } from 'next/server';
import { generateAirportStatus } from '@/lib/simData';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const airport = searchParams.get('airport');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const base = airport
      ? `https://nasstatus.faa.gov/api/airport-status-information?Airport=${airport}`
      : `https://nasstatus.faa.gov/api/airport-status-information`;

    const res = await fetch(base, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('FAA non-200');
    const data = await res.json();
    return NextResponse.json({ source: 'faa-nas', data });
  } catch {
    return NextResponse.json({ source: 'simulation', data: generateAirportStatus() });
  }
}
