// AviationWeather.gov — SIGMETs, AIRMETs, PIREPs
// Falls back to live simulation when unreachable
import { NextRequest, NextResponse } from 'next/server';
import { generateSIGMETs, generateAIRMETs, generatePIREPs } from '@/lib/simData';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'sigmet';

  const urls: Record<string, string> = {
    sigmet: 'https://aviationweather.gov/api/data/sigmet?format=json',
    airmet: 'https://aviationweather.gov/api/data/airmet?format=json',
    pirep:  'https://aviationweather.gov/api/data/pirep?format=json&age=3&distance=200',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(urls[type] ?? urls.sigmet, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('AviationWeather non-200');
    const data = await res.json();
    return NextResponse.json({ source: 'aviationweather', data });
  } catch {
    const fallback =
      type === 'airmet' ? generateAIRMETs() :
      type === 'pirep'  ? generatePIREPs() :
                          generateSIGMETs();
    return NextResponse.json({ source: 'simulation', data: fallback });
  }
}
