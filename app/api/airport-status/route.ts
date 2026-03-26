// FAA NAS Status — free public API, no key needed
// Returns real-time airport delays, ground stops, and ground delay programs
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const airport = searchParams.get('airport'); // optional: specific airport IATA code

  try {
    // FAA public airport status endpoint
    const base = airport
      ? `https://nasstatus.faa.gov/api/airport-status-information?Airport=${airport}`
      : `https://nasstatus.faa.gov/api/airport-status-information`;

    const res = await fetch(base, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      // Fallback: try the older FAA Aviation system status endpoint
      const fallback = await fetch('https://soa.smext.faa.gov/asws/api/airport/status/JFK', {
        headers: { Accept: 'application/json' },
      });
      if (fallback.ok) {
        const d = await fallback.json();
        return NextResponse.json({ source: 'faa-asws', data: [d] });
      }
      return NextResponse.json({ error: 'FAA status unavailable', data: [] }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ source: 'faa-nas', data });
  } catch {
    return NextResponse.json({ error: 'Fetch failed', data: [] }, { status: 200 });
  }
}
