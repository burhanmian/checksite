// OpenSky Network — free, no API key required
// Returns real-time flight state vectors for a geographic bounding box
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 15; // cache for 15 seconds

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lamin = searchParams.get('lamin') ?? '24';
  const lamax = searchParams.get('lamax') ?? '50';
  const lomin = searchParams.get('lomin') ?? '-125';
  const lomax = searchParams.get('lomax') ?? '-60';

  try {
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
    const res = await fetch(url, { next: { revalidate: 15 } });

    if (!res.ok) {
      return NextResponse.json({ error: 'OpenSky unavailable', states: [] }, { status: 200 });
    }

    const data = await res.json();

    // Map OpenSky state vectors to a friendly shape
    // columns: icao24, callsign, origin_country, time_position, last_contact,
    //          longitude, latitude, baro_altitude, on_ground, velocity,
    //          true_track, vertical_rate, sensors, geo_altitude, squawk,
    //          spi, position_source
    const flights = (data.states ?? [])
      .filter((s: unknown[]) => s[5] !== null && s[6] !== null && s[1])
      .map((s: unknown[]) => ({
        icao24: s[0],
        callsign: (s[1] as string)?.trim() ?? '',
        originCountry: s[2],
        longitude: s[5],
        latitude: s[6],
        baroAltitude: s[7] ? Math.round((s[7] as number) * 3.28084) : null, // m→ft
        onGround: s[8],
        velocity: s[9] ? Math.round((s[9] as number) * 1.94384) : null,     // m/s→kts
        trueTrack: s[10],
        verticalRate: s[11],
        squawk: s[14],
      }))
      .slice(0, 200); // limit to 200 aircraft

    return NextResponse.json({ time: data.time, flights });
  } catch {
    return NextResponse.json({ error: 'Fetch failed', states: [] }, { status: 200 });
  }
}
