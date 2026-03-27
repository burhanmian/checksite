/**
 * Realistic live simulation engine.
 * Generates data that changes over time so the UI feels truly live.
 * Used as fallback when external APIs (OpenSky, AviationWeather, FAA) are unreachable.
 * On Vercel/real deployments the real APIs are always tried first.
 */

// ─── Airport database ────────────────────────────────────────────────────────
export const SIM_AIRPORTS = [
  { icao: 'KJFK', iata: 'JFK', name: 'John F. Kennedy Intl', city: 'New York',      lat: 40.6413, lon: -73.7781, tz: -5 },
  { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles Intl',      city: 'Los Angeles',  lat: 33.9425, lon: -118.408, tz: -8 },
  { icao: 'KORD', iata: 'ORD', name: "O'Hare Intl",           city: 'Chicago',      lat: 41.9742, lon: -87.9073, tz: -6 },
  { icao: 'KATL', iata: 'ATL', name: 'Hartsfield-Jackson',    city: 'Atlanta',      lat: 33.6407, lon: -84.4277, tz: -5 },
  { icao: 'KDFW', iata: 'DFW', name: 'Dallas/Fort Worth Intl',city: 'Dallas',       lat: 32.8998, lon: -97.0403, tz: -6 },
  { icao: 'KDEN', iata: 'DEN', name: 'Denver Intl',           city: 'Denver',       lat: 39.8561, lon: -104.674, tz: -7 },
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco Intl',    city: 'San Francisco',lat: 37.6213, lon: -122.379, tz: -8 },
  { icao: 'KBOS', iata: 'BOS', name: 'Logan Intl',            city: 'Boston',       lat: 42.3656, lon: -71.0096, tz: -5 },
  { icao: 'KMIA', iata: 'MIA', name: 'Miami Intl',            city: 'Miami',        lat: 25.7959, lon: -80.287,  tz: -5 },
  { icao: 'KLAS', iata: 'LAS', name: 'Harry Reid Intl',       city: 'Las Vegas',    lat: 36.0840, lon: -115.153, tz: -8 },
  { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow',       city: 'London',       lat: 51.4775, lon: -0.4614,  tz: 0  },
  { icao: 'LFPG', iata: 'CDG', name: 'Charles de Gaulle',     city: 'Paris',        lat: 49.0097, lon: 2.5479,   tz: 1  },
  { icao: 'EDDF', iata: 'FRA', name: 'Frankfurt Airport',     city: 'Frankfurt',    lat: 50.0333, lon: 8.5706,   tz: 1  },
  { icao: 'EHAM', iata: 'AMS', name: 'Amsterdam Schiphol',    city: 'Amsterdam',    lat: 52.3086, lon: 4.7639,   tz: 1  },
  { icao: 'OMDB', iata: 'DXB', name: 'Dubai International',   city: 'Dubai',        lat: 25.2532, lon: 55.3657,  tz: 4  },
  { icao: 'RJTT', iata: 'HND', name: 'Tokyo Haneda',          city: 'Tokyo',        lat: 35.5494, lon: 139.7798, tz: 9  },
  { icao: 'ZBAA', iata: 'PEK', name: 'Beijing Capital Intl',  city: 'Beijing',      lat: 40.0799, lon: 116.603,  tz: 8  },
  { icao: 'WSSS', iata: 'SIN', name: 'Singapore Changi',      city: 'Singapore',    lat: 1.3644,  lon: 103.9915, tz: 8  },
  { icao: 'YSSY', iata: 'SYD', name: 'Sydney Kingsford Smith',city: 'Sydney',       lat: -33.9461,lon: 151.177,  tz: 11 },
  { icao: 'SBGR', iata: 'GRU', name: 'São Paulo–Guarulhos',   city: 'São Paulo',    lat: -23.4356,lon: -46.4731, tz: -3 },
];

// ─── Airline / callsign database ─────────────────────────────────────────────
const AIRLINES = [
  { prefix: 'AAL', name: 'American Airlines',   country: 'United States' },
  { prefix: 'UAL', name: 'United Airlines',     country: 'United States' },
  { prefix: 'DAL', name: 'Delta Air Lines',     country: 'United States' },
  { prefix: 'SWA', name: 'Southwest Airlines',  country: 'United States' },
  { prefix: 'BAW', name: 'British Airways',     country: 'United Kingdom' },
  { prefix: 'AFR', name: 'Air France',          country: 'France' },
  { prefix: 'DLH', name: 'Lufthansa',           country: 'Germany' },
  { prefix: 'UAE', name: 'Emirates',            country: 'United Arab Emirates' },
  { prefix: 'ANA', name: 'All Nippon Airways',  country: 'Japan' },
  { prefix: 'CCA', name: 'Air China',           country: 'China' },
  { prefix: 'SIA', name: 'Singapore Airlines',  country: 'Singapore' },
  { prefix: 'QFA', name: 'Qantas',              country: 'Australia' },
  { prefix: 'TAM', name: 'LATAM Brasil',        country: 'Brazil' },
  { prefix: 'IBE', name: 'Iberia',              country: 'Spain' },
  { prefix: 'KLM', name: 'KLM Royal Dutch',     country: 'Netherlands' },
  { prefix: 'VIR', name: 'Virgin Atlantic',     country: 'United Kingdom' },
  { prefix: 'JBU', name: 'JetBlue Airways',     country: 'United States' },
  { prefix: 'ASA', name: 'Alaska Airlines',     country: 'United States' },
  { prefix: 'NKS', name: 'Spirit Airlines',     country: 'United States' },
  { prefix: 'FFT', name: 'Frontier Airlines',   country: 'United States' },
];

// ─── Seeded pseudo-random (deterministic per seed) ───────────────────────────
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Generate live aircraft ───────────────────────────────────────────────────
export function generateLiveFlights(count = 180) {
  const now = Date.now();
  const cycleMs = 15000; // matches frontend poll interval
  const t = (now % cycleMs) / cycleMs; // 0→1 within current cycle

  const flights = [];
  for (let i = 0; i < count; i++) {
    const rand = seededRand(i * 9973 + 12345);
    const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)];
    const flightNum = Math.floor(rand() * 9000) + 100;

    // Pick random origin / destination
    const originIdx = Math.floor(rand() * SIM_AIRPORTS.length);
    let destIdx = Math.floor(rand() * SIM_AIRPORTS.length);
    if (destIdx === originIdx) destIdx = (destIdx + 1) % SIM_AIRPORTS.length;

    const origin = SIM_AIRPORTS[originIdx];
    const dest   = SIM_AIRPORTS[destIdx];

    // Position: interpolate between origin and destination
    const progress = (rand() * 0.7 + 0.15); // 15–85% of route
    const nudge = rand() * 0.02 - 0.01;     // tiny drift per cycle
    const frac = Math.max(0, Math.min(1, progress + t * nudge));

    const lat = lerp(origin.lat, dest.lat, frac) + (rand() * 0.4 - 0.2);
    const lon = lerp(origin.lon, dest.lon, frac) + (rand() * 0.4 - 0.2);

    // Heading from origin → dest
    const dlat = dest.lat - origin.lat;
    const dlon = dest.lon - origin.lon;
    const heading = (Math.atan2(dlon, dlat) * 180 / Math.PI + 360) % 360;

    // Altitude (cruise = 35k ft, vary a little)
    const isGround = rand() < 0.12;
    const altFt = isGround ? 0 : Math.round((28000 + rand() * 13000) / 100) * 100;

    // Speed (kts)
    const speedKts = isGround ? 0 : Math.round(420 + rand() * 140);

    // Vertical rate
    const vr = isGround ? 0 : (rand() < 0.1 ? (rand() * 20 - 10) : 0); // m/s

    // ICAO24 hex
    const icao24 = (i * 0x1a3f + 0x3c2d00).toString(16).padStart(6, '0').slice(0, 6);

    flights.push({
      icao24,
      callsign: `${airline.prefix}${flightNum}`,
      originCountry: airline.country,
      longitude: Math.round(lon * 1000) / 1000,
      latitude:  Math.round(lat * 1000) / 1000,
      baroAltitude: altFt,
      onGround: isGround,
      velocity: speedKts,
      trueTrack: Math.round(heading),
      verticalRate: vr,
      squawk: isGround ? null : `${Math.floor(rand() * 7) + 1}${Math.floor(rand() * 999).toString().padStart(3,'0')}`,
    });
  }
  return flights;
}

// ─── Generate METAR data ──────────────────────────────────────────────────────
const WEATHER_SCENARIOS = [
  { fltcat: 'VFR',  temp: 22, wspd: 8,  visib: 10,   cover: 'FEW020',     wx: '',           altim: 29.92, desc: 'Clear and sunny' },
  { fltcat: 'VFR',  temp: 18, wspd: 12, visib: 10,   cover: 'SCT040',     wx: '',           altim: 30.01, desc: 'Partly cloudy' },
  { fltcat: 'MVFR', temp: 14, wspd: 16, visib: 5,    cover: 'BKN020',     wx: '-RA',        altim: 29.75, desc: 'Light rain' },
  { fltcat: 'MVFR', temp: 8,  wspd: 22, visib: 6,    cover: 'OVC030',     wx: 'BR',         altim: 29.60, desc: 'Mist, overcast' },
  { fltcat: 'IFR',  temp: 6,  wspd: 25, visib: 1.5,  cover: 'OVC006',     wx: 'RA BR',      altim: 29.45, desc: 'Rain, low ceilings' },
  { fltcat: 'IFR',  temp: 3,  wspd: 18, visib: 1,    cover: 'OVC003',     wx: '-SN BR',     altim: 29.30, desc: 'Light snow, IFR' },
  { fltcat: 'LIFR', temp: 10, wspd: 5,  visib: 0.25, cover: 'OVC001',     wx: 'FG',         altim: 29.88, desc: 'Dense fog' },
  { fltcat: 'IFR',  temp: 12, wspd: 35, visib: 3,    cover: 'BKN010CB',   wx: 'TSRA',       altim: 29.20, desc: 'Thunderstorm' },
];

export function generateMETARs() {
  const now = Date.now();
  return SIM_AIRPORTS.map((apt, i) => {
    const rand = seededRand(i * 7919 + Math.floor(now / 3600000)); // changes hourly
    const scenario = WEATHER_SCENARIOS[Math.floor(rand() * WEATHER_SCENARIOS.length)];
    const windDir = Math.floor(rand() * 36) * 10;
    const gust = scenario.wspd > 20 ? Math.round(scenario.wspd + rand() * 10) : undefined;
    const temp = Math.round(scenario.temp + rand() * 4 - 2);
    const dewp = temp - Math.round(rand() * 8 + 2);

    const gStr = gust ? `G${gust}KT` : 'KT';
    const rawOb = `${apt.icao} ${new Date().toISOString().slice(2,10).replace(/-/g,'')}Z ${String(windDir).padStart(3,'0')}${String(scenario.wspd).padStart(2,'0')}${gStr} ${scenario.visib}SM ${scenario.cover} ${scenario.wx} ${temp.toString().padStart(2,'0')}/${dewp.toString().padStart(2,'0')} A${String(Math.round(scenario.altim * 100)).padStart(4,'0')}`.trim();

    return {
      icaoId: apt.icao,
      name: apt.name,
      temp,
      dewp,
      wdir: windDir,
      wspd: scenario.wspd,
      wgst: gust,
      visib: scenario.visib,
      cover: scenario.cover.slice(0, 3),
      cldCvg1: scenario.cover.slice(0, 3),
      cldBas1: parseInt(scenario.cover.slice(3)) || 0,
      altim: scenario.altim,
      fltcat: scenario.fltcat,
      rawOb,
      wxString: scenario.wx || undefined,
      reportTime: new Date().toISOString(),
    };
  });
}

// ─── Generate FAA-style airport status ───────────────────────────────────────
const DELAY_PROGRAMS = [
  { type: 'Ground Stop', Reason: 'Thunderstorm activity', MinDelay: '0 minutes', MaxDelay: '120 minutes', AvgDelay: '60 minutes' },
  { type: 'Ground Delay', Reason: 'Low visibility / IFR conditions', MinDelay: '15 minutes', MaxDelay: '75 minutes', AvgDelay: '35 minutes' },
  { type: 'Airspace Flow', Reason: 'Volume — high traffic demand', MinDelay: '10 minutes', MaxDelay: '45 minutes', AvgDelay: '22 minutes' },
  { type: 'Arrival Delay', Reason: 'Wind — crosswind limits exceeded', MinDelay: '20 minutes', MaxDelay: '60 minutes', AvgDelay: '38 minutes' },
  { type: 'Departure Delay', Reason: 'Staffing — TSA checkpoint closures', MinDelay: '30 minutes', MaxDelay: '90 minutes', AvgDelay: '55 minutes' },
];

export function generateAirportStatus() {
  const now = Date.now();
  const rand = seededRand(Math.floor(now / 1800000)); // changes every 30 min
  const numDelayed = Math.floor(rand() * 4) + 2; // 2-5 airports delayed

  return SIM_AIRPORTS.slice(0, 12).map((apt, i) => {
    const r2 = seededRand(i + Math.floor(now / 1800000) * 100);
    const hasDelay = i < numDelayed;
    const prog = DELAY_PROGRAMS[Math.floor(r2() * DELAY_PROGRAMS.length)];

    return {
      ARPT: apt.iata,
      Name: apt.name,
      City: apt.city,
      State: '',
      Status: hasDelay ? 'delay' : 'normal',
      Programs: hasDelay ? [prog] : [],
      Delays: [],
    };
  });
}

// ─── Generate SIGMETs ─────────────────────────────────────────────────────────
const SIGMET_HAZARDS = ['TS', 'TURB', 'ICE', 'VA', 'TURB'];
const SIGMET_AREAS = [
  'FROM 60W TO 50N70W TO 40N60W TO 45N80W TO 60W',
  'FROM MSP TO DTW TO CLE TO PIT TO MSP',
  'FROM ORD TO DET TO CLE TO PIT TO ORD',
  'AREA FROM 30N090W TO 30N080W TO 40N080W TO 40N090W TO 30N090W',
];

export function generateSIGMETs() {
  const now = Date.now();
  const rand = seededRand(Math.floor(now / 7200000)); // changes every 2h
  const count = Math.floor(rand() * 4) + 2;

  return Array.from({ length: count }, (_, i) => {
    const r = seededRand(i * 31337 + Math.floor(now / 7200000));
    const hazard = SIGMET_HAZARDS[Math.floor(r() * SIGMET_HAZARDS.length)];
    const area = SIGMET_AREAS[Math.floor(r() * SIGMET_AREAS.length)];
    const validFrom = new Date(now - r() * 3600000).toISOString();
    const validTo   = new Date(now + (r() * 4 + 2) * 3600000).toISOString();
    const fl1 = Math.floor(r() * 15 + 5) * 10;
    const fl2 = fl1 + Math.floor(r() * 20 + 10) * 10;
    const alpha = String.fromCharCode(65 + i);

    return {
      icaoId: 'KKCI',
      alphaChar: `SIERRA ${alpha}`,
      hazard,
      severity: hazard === 'TS' ? 'EXTREME' : 'MODERATE',
      validTimeFrom: validFrom,
      validTimeTo: validTo,
      altitudeLow1: fl1 * 100,
      altitudeHi1: fl2 * 100,
      rawAirSigmet: `KKCI SIGMET SIERRA ${alpha} VALID ${new Date(validFrom).toUTCString().slice(17,22)}/${new Date(validTo).toUTCString().slice(17,22)}Z KKCI- ZCHI CHICAGO FIR ${hazard} ${area}. FL${fl1}/FL${fl2}. MOV NE 25KT. INTSF.`,
    };
  });
}

// ─── Generate AIRMETs ─────────────────────────────────────────────────────────
export function generateAIRMETs() {
  const now = Date.now();
  return [
    {
      icaoId: 'KKCI', alphaChar: 'SIERRA 1', hazard: 'IFR',
      validTimeFrom: new Date(now - 3600000).toISOString(),
      validTimeTo: new Date(now + 5400000).toISOString(),
      rawAirmet: 'KKCI AIRMET SIERRA FOR IFR AND MTN OBSCN VALID UNTIL 0600Z. FROM MSP TO DTW TO CLE TO MSP. CIG BLW 010/VIS BLW 3SM PCPN/BR/FG. CONDS CONTG BYD 0600Z ENDG 1200Z.',
    },
    {
      icaoId: 'KKCI', alphaChar: 'TANGO 1', hazard: 'TURB',
      validTimeFrom: new Date(now - 1800000).toISOString(),
      validTimeTo: new Date(now + 7200000).toISOString(),
      rawAirmet: 'KKCI AIRMET TANGO FOR TURB VALID UNTIL 0900Z. FROM BOS TO ACY TO ORF TO BOS. MOD TURB BTWN FL180 AND FL360. CONDS DVLPG BY 0300Z. CONTG BYD 0900Z.',
    },
    {
      icaoId: 'KKCI', alphaChar: 'ZULU 1', hazard: 'ICE',
      validTimeFrom: new Date(now - 900000).toISOString(),
      validTimeTo: new Date(now + 10800000).toISOString(),
      rawAirmet: 'KKCI AIRMET ZULU FOR ICE VALID UNTIL 1200Z. FROM GRB TO MKE TO MDW TO GRB. MOD ICE BTWN 060 AND 180. CONDS CONTG BYD 1200Z.',
    },
  ];
}

// ─── Generate PIREPs ──────────────────────────────────────────────────────────
const TURB_LEVELS = ['NEG', 'SMTH-LGT', 'LGT', 'LGT-MOD', 'MOD', 'MOD-SEV', 'SEV'];
const ICE_LEVELS  = ['NEG', 'TRACE', 'TRACE-LGT', 'LGT', 'LGT-MOD', 'MOD'];

export function generatePIREPs() {
  const now = Date.now();
  const pireps = [];
  for (let i = 0; i < 30; i++) {
    const r = seededRand(i * 6577 + Math.floor(now / 900000));
    const apt = SIM_AIRPORTS[Math.floor(r() * SIM_AIRPORTS.length)];
    const fl = Math.floor(r() * 350 + 50) * 100;
    const turb = TURB_LEVELS[Math.floor(r() * TURB_LEVELS.length)];
    const ice  = ICE_LEVELS[Math.floor(r() * ICE_LEVELS.length)];
    const temp = Math.round(-20 + r() * 15);
    const wdir = Math.floor(r() * 36) * 10;
    const wspd = Math.floor(r() * 80 + 20);

    pireps.push({
      icaoId: apt.icao,
      altitude: fl,
      turbInten: turb !== 'NEG' ? turb : undefined,
      iceInten: ice !== 'NEG' ? ice : undefined,
      temp,
      wdir,
      wspd,
      rawOb: `UA /OV ${apt.icao} /TM ${new Date(now - r()*3600000).toISOString().slice(11,16).replace(':','')} /FL${String(fl/100).padStart(3,'0')} /TP ${['B737','B738','A320','A321','B789','A350','B77W'][Math.floor(r()*7)]} /SK ${['FEW030','SCT060','OVC080','CLR'][Math.floor(r()*4)]} /TA ${temp} /WV ${wdir.toString().padStart(3,'0')}${wspd.toString().padStart(3,'0')} /TB ${turb} /IC ${ice} /RM SMOOTH`,
      latitude: apt.lat + (r() * 2 - 1),
      longitude: apt.lon + (r() * 2 - 1),
    });
  }
  return pireps;
}
