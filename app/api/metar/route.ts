// AviationWeather.gov — completely free, no key needed
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 60;

const DEFAULT_STATIONS = 'KJFK,KORD,KLAX,KATL,KDFW,KDEN,KSFO,KBOS,KMIA,KEWR,EGLL,OMDB,RJTT,LFPG,LLBG';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get('ids') ?? DEFAULT_STATIONS;

  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${ids}&format=json&hours=2`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      return NextResponse.json({ error: 'AviationWeather unavailable', data: [] }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Fetch failed', data: [] }, { status: 200 });
  }
}
