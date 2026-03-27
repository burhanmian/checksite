// AviationWeather.gov — free, no key needed
// Falls back to live simulation when unreachable
import { NextRequest, NextResponse } from 'next/server';
import { generateMETARs } from '@/lib/simData';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get('ids') ?? '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);
    const stations = ids || 'KJFK,KORD,KLAX,KATL,KDFW,KDEN,KSFO,KBOS,KMIA,KEWR,EGLL,OMDB,RJTT,LFPG,EDDF,EHAM,ZBAA,WSSS,YSSY,SBGR';
    const url = `https://aviationweather.gov/api/data/metar?ids=${stations}&format=json&hours=2`;
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('AviationWeather non-200');
    const data = await res.json();
    return NextResponse.json({ source: 'aviationweather', data });
  } catch {
    // Fallback: simulated METARs matching real airport ICAO codes
    let data = generateMETARs();
    if (ids) {
      const reqIds = ids.toUpperCase().split(',');
      data = data.filter(m => reqIds.includes(m.icaoId));
    }
    return NextResponse.json({ source: 'simulation', data });
  }
}
