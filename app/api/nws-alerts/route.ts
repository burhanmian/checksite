// National Weather Service (NWS) API — 100% free, no API key needed
// Returns active weather alerts affecting aviation across the US
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SIM_ALERTS = [
  { id: 'SIM-001', event: 'Severe Thunderstorm Warning', headline: 'Severe Thunderstorm Warning for Chicago O\'Hare area', area: 'Cook County, IL', severity: 'Extreme', urgency: 'Immediate', description: 'A severe thunderstorm is producing large hail and dangerous wind gusts. At 8:45 PM CDT, Doppler radar indicated a severe thunderstorm near O\'Hare International Airport, moving northeast at 40 mph.', onset: new Date(Date.now() - 1800000).toISOString(), expires: new Date(Date.now() + 3600000).toISOString(), affectedAirports: ['KORD', 'KMDW'] },
  { id: 'SIM-002', event: 'Dense Fog Advisory', headline: 'Dense Fog Advisory for New York metro airports', area: 'New York, NJ Metro', severity: 'Moderate', urgency: 'Expected', description: 'Dense fog with visibility near zero in spots through 10 AM. Travel is discouraged. If you must travel, use caution. Visibility as low as a quarter mile possible near KJFK, KEWR, and KLGA.', onset: new Date(Date.now() - 7200000).toISOString(), expires: new Date(Date.now() + 14400000).toISOString(), affectedAirports: ['KJFK', 'KEWR', 'KLGA'] },
  { id: 'SIM-003', event: 'Winter Storm Warning', headline: 'Winter Storm Warning — 8-14 inches of snow expected', area: 'Boston Metro', severity: 'Extreme', urgency: 'Immediate', description: 'Heavy snow expected. Total snow accumulations of 8 to 14 inches. Plan on slippery road conditions. Travel could be very difficult to impossible. BOS airport may experience significant delays and cancellations.', onset: new Date(Date.now() + 7200000).toISOString(), expires: new Date(Date.now() + 86400000).toISOString(), affectedAirports: ['KBOS', 'KORH'] },
  { id: 'SIM-004', event: 'Wind Advisory', headline: 'Wind Advisory — Gusts to 55 mph', area: 'Los Angeles County', severity: 'Minor', urgency: 'Expected', description: 'Southwest winds 25 to 35 mph with gusts up to 55 mph. Gusty winds could blow around unsecured objects. Crosswind operations in effect at LAX for certain aircraft types.', onset: new Date(Date.now() - 3600000).toISOString(), expires: new Date(Date.now() + 21600000).toISOString(), affectedAirports: ['KLAX', 'KBUR'] },
];

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert&urgency=Immediate,Expected&severity=Extreme,Severe,Moderate', {
      headers: { 'User-Agent': 'SkyWatch/1.0 (contact@skywatch.app)', Accept: 'application/geo+json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('NWS non-200');

    const data = await res.json();
    const alerts = (data.features ?? []).slice(0, 20).map((f: Record<string, unknown>) => {
      const p = f.properties as Record<string, unknown>;
      return {
        id: p.id,
        event: p.event,
        headline: p.headline,
        area: p.areaDesc,
        severity: p.severity,
        urgency: p.urgency,
        description: (p.description as string ?? '').slice(0, 400),
        onset: p.onset,
        expires: p.expires,
        affectedAirports: [],
      };
    });

    return NextResponse.json({ source: 'nws', data: alerts });
  } catch {
    return NextResponse.json({ source: 'simulation', data: SIM_ALERTS });
  }
}
