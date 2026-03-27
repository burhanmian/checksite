// AI Flight Briefing — powered by Claude (claude-opus-4-6)
// Streams a real-time NAS intelligence briefing based on current live data snapshot
import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { flights = [], metars = [], airportStatus = [], sigmets = [], nwsAlerts = [] } = body;

  const airborne = (flights as { onGround: boolean }[]).filter(f => !f.onGround).length;
  const ifrAirports = (metars as { fltcat: string; icaoId: string }[])
    .filter(m => m.fltcat === 'IFR' || m.fltcat === 'LIFR')
    .map(m => m.icaoId);
  const delayedAirports = (airportStatus as { ARPT?: string; Programs?: unknown[] }[])
    .filter(a => (a.Programs?.length ?? 0) > 0)
    .map(a => a.ARPT);
  const activeSigmets = (sigmets as { hazard?: string; area?: string }[]).slice(0, 3);
  const activeAlerts = (nwsAlerts as { event?: string; area?: string; severity?: string }[]).slice(0, 3);

  const prompt = `You are a senior FAA air traffic control supervisor providing a real-time National Airspace System (NAS) intelligence briefing. Analyze the following live data snapshot and deliver a crisp, professional briefing like an ATC supervisor would.

LIVE DATA SNAPSHOT (${new Date().toUTCString()}):
- Airborne aircraft tracked: ${airborne}
- IFR/LIFR airports: ${ifrAirports.length > 0 ? ifrAirports.join(', ') : 'None'}
- Airports with active delay programs: ${delayedAirports.length > 0 ? delayedAirports.join(', ') : 'None'}
- Active SIGMETs: ${activeSigmets.length > 0 ? activeSigmets.map(s => `${s.hazard} over ${s.area}`).join('; ') : 'None'}
- Active NWS Aviation Alerts: ${activeAlerts.length > 0 ? activeAlerts.map(a => `${a.severity} ${a.event} (${a.area})`).join('; ') : 'None'}

Deliver a briefing covering:
1. **NAS Status** — Overall system health (1-2 sentences)
2. **Hotspots** — Specific airports or regions with active issues
3. **Weather Threats** — IFR conditions, SIGMETs, or severe weather impacting operations
4. **Delays & Ground Stops** — Any active programs and estimated impact
5. **Forecast** — Short-term outlook for the next 2 hours

Keep it under 180 words. Use aviation shorthand (SIGMET, IFR, GS, GDP, etc.). Be direct and actionable.`;

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          // If API key is missing/invalid, stream a helpful fallback briefing
          const fallback = generateFallbackBriefing(airborne, ifrAirports, delayedAirports, activeSigmets);
          controller.enqueue(encoder.encode(fallback));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    const fallback = generateFallbackBriefing(airborne, ifrAirports, delayedAirports, activeSigmets);
    return new Response(fallback, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

function generateFallbackBriefing(
  airborne: number,
  ifrAirports: string[],
  delayedAirports: (string | undefined)[],
  sigmets: { hazard?: string; area?: string }[],
): string {
  const time = new Date().toUTCString();
  const nasStatus = delayedAirports.length === 0 && ifrAirports.length <= 2
    ? 'NAS operating at normal capacity with no significant system-wide impacts.'
    : `NAS experiencing moderate impacts with ${delayedAirports.length} active delay program${delayedAirports.length !== 1 ? 's' : ''}.`;

  const hotspots = ifrAirports.length > 0
    ? `**Hotspots:** ${ifrAirports.slice(0, 4).join(', ')} reporting IFR/LIFR conditions. Expect instrument approach operations.`
    : '**Hotspots:** No significant hotspot airports at this time.';

  const weather = sigmets.length > 0
    ? `**Weather:** ${sigmets.length} active SIGMET${sigmets.length > 1 ? 's' : ''} — ${sigmets[0].hazard} over ${sigmets[0].area}. Pilots advised to check NOTAMs.`
    : '**Weather:** No active SIGMETs. VFR conditions predominant across most of the NAS.';

  const delays = delayedAirports.length > 0
    ? `**Delays:** Ground delay programs active at ${delayedAirports.filter(Boolean).slice(0, 3).join(', ')}. Expect 30-90 min arrival delays.`
    : '**Delays:** No active GDPs or ground stops reported by FAA NAS.';

  return `*NAS Briefing — ${time}*\n\n**NAS Status:** ${nasStatus}\n\n${hotspots}\n\n${weather}\n\n${delays}\n\n**Forecast:** Conditions expected to ${delayedAirports.length > 1 ? 'improve gradually over the next 2 hours as weather systems move through' : 'remain stable for the next 2 hours'}. Monitor ATC advisories for updates.\n\n*${airborne} aircraft currently airborne in tracked region.*\n\n⚠️ *Add your ANTHROPIC_API_KEY to .env.local for live AI analysis powered by Claude Opus 4.6.*`;
}
