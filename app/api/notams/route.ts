// AviationWeather.gov NOTAM-like data — Pilot Weather Reports + Sigmets/Airmets
// Also fetches Sigmets which are safety-critical weather advisories for pilots
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 120;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'sigmet'; // sigmet | airmet | pirep

  try {
    let url = '';
    if (type === 'sigmet') {
      url = 'https://aviationweather.gov/api/data/sigmet?format=json';
    } else if (type === 'airmet') {
      url = 'https://aviationweather.gov/api/data/airmet?format=json';
    } else if (type === 'pirep') {
      url = 'https://aviationweather.gov/api/data/pirep?format=json&age=3&distance=200';
    } else {
      url = 'https://aviationweather.gov/api/data/sigmet?format=json';
    }

    const res = await fetch(url, { next: { revalidate: 120 } });

    if (!res.ok) {
      return NextResponse.json({ error: 'AviationWeather unavailable', data: [] }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Fetch failed', data: [] }, { status: 200 });
  }
}
