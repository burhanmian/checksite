export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FlightStatus = 'on_time' | 'delayed' | 'cancelled' | 'diverted' | 'landed' | 'airborne' | 'boarding' | 'scheduled';
export type WeatherCondition = 'clear' | 'clouds' | 'rain' | 'snow' | 'fog' | 'hail' | 'thunderstorm' | 'wind';

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
  status: 'normal' | 'delays' | 'ground_stop' | 'closure' | 'advisory';
  delayMinutes?: number;
}

export interface Flight {
  flightNumber: string;
  callsign: string;
  airline: string;
  origin: Airport;
  destination: Airport;
  departureTime: string;
  arrivalTime: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  status: FlightStatus;
  delayMinutes: number;
  aircraft: string;
  altitude?: number;
  speed?: number;
  lat?: number;
  lon?: number;
  heading?: number;
  progress?: number;
}

export interface Alert {
  id: string;
  type: 'weather' | 'notam' | 'ground_stop' | 'tsa' | 'delay' | 'cancellation' | 'diversion' | 'security';
  severity: AlertSeverity;
  airport: string;
  airportCode: string;
  title: string;
  description: string;
  timestamp: string;
  expiresAt?: string;
  affectedFlights?: number;
  source: string;
}

export interface METAR {
  icao: string;
  rawText: string;
  observationTime: string;
  temp: number;
  dewpoint: number;
  windDirection: number;
  windSpeed: number;
  windGust?: number;
  visibility: number;
  clouds: Array<{ coverage: string; altitude: number }>;
  flightRules: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  conditions?: WeatherCondition[];
  altimeter: number;
}

export interface NOTAM {
  id: string;
  icao: string;
  type: string;
  description: string;
  startTime: string;
  endTime: string;
  classification: 'CRITICAL' | 'HIGH' | 'LOW';
  affectsRunway?: boolean;
  affectsNavaid?: boolean;
}

export interface RouteStats {
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  onTimePercentage: number;
  avgDelay: number;
  cancellationRate: number;
  totalFlightsToday: number;
  alertLevel: 'green' | 'yellow' | 'red';
}

export interface AirportStats {
  icao: string;
  iata: string;
  name: string;
  city: string;
  totalMovements: number;
  onTimeRate: number;
  avgDelay: number;
  topAirlines: Array<{ name: string; flights: number; onTime: number }>;
  topRoutes: Array<{ destination: string; city: string; frequency: number }>;
  currentCapacity: number;
  runwaysActive: number;
  runwaysTotal: number;
  flightRules: string;
  rank: number;
}
