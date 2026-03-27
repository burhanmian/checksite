// OpenSky Network — free, no API key required
// Falls back to live simulation engine when external API is unreachable
import { NextRequest, NextResponse } from 'next/server';
import { generateLiveFlights } from '@/lib/simData';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lamin = searchParams.get('lamin') ?? '24';
  const lamax = searchParams.get('lamax') ?? '50';
  const lomin = searchParams.get('lomin') ?? '-125';
  const lomax = searchParams.get('lomax') ?? '-60';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('OpenSky non-200');

    const data = await res.json();
    const flights = (data.states ?? [])
      .filter((s: unknown[]) => s[5] !== null && s[6] !== null && s[1])
      .map((s: unknown[]) => ({
        icao24: s[0],
        callsign: (s[1] as string)?.trim() ?? '',
        originCountry: s[2],
        longitude: s[5],
        latitude: s[6],
        baroAltitude: s[7] ? Math.round((s[7] as number) * 3.28084) : null,
        onGround: s[8],
        velocity: s[9] ? Math.round((s[9] as number) * 1.94384) : null,
        trueTrack: s[10],
        verticalRate: s[11],
        squawk: s[14],
      }))
      .slice(0, 200);

    return NextResponse.json({ source: 'opensky', time: data.time, flights });
  } catch {
    // Fallback: live simulation with positions that update every poll cycle
    const la = parseFloat(lamin), lb = parseFloat(lamax);
    const lo = parseFloat(lomin), lx = parseFloat(lomax);
    const all = generateLiveFlights(180);
    const filtered = all.filter(f =>
      f.latitude >= la && f.latitude <= lb &&
      f.longitude >= lo && f.longitude <= lx
    );
    return NextResponse.json({
      source: 'simulation',
      time: Math.floor(Date.now() / 1000),
      flights: filtered.length > 0 ? filtered : all.slice(0, 60),
    });
  }
}
