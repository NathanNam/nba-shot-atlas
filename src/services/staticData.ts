// Static shot data built by scripts/build_data.py into public/data/.
// One columnar JSON file per season; each is fetched once and decoded once.
import type { ShotData } from './supabaseDataService';

interface SeasonFile {
  season: string;
  count: number;
  teams: string[];
  subTypes: string[];
  playerIds: number[];
  p: number[];
  t: number[];
  x: number[];
  y: number[];
  d: number[];
  m: number[];
  v: number[];
  s: number[];
}

export interface SeasonIndex {
  seasons: string[];
  default: string;
}

const BASE = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

let seasonIndex: Promise<SeasonIndex> | null = null;
/** [personId, full name, season start years in which they took a shot] */
export type PlayerRow = [number, string, number[]];

let playerList: Promise<PlayerRow[]> | null = null;
const seasonShots = new Map<string, Promise<ShotData[]>>();

export function loadSeasonIndex(): Promise<SeasonIndex> {
  seasonIndex ??= getJson<SeasonIndex>('seasons.json');
  return seasonIndex;
}

export function loadPlayers(): Promise<PlayerRow[]> {
  playerList ??= getJson<PlayerRow[]>('players.json');
  return playerList;
}

function decode(f: SeasonFile): ShotData[] {
  const ids = f.playerIds.map(String);
  const shots: ShotData[] = new Array(f.count);
  for (let i = 0; i < f.count; i++) {
    shots[i] = {
      personId: ids[f.p[i]],
      teamTricode: f.teams[f.t[i]],
      xLegacy: f.x[i],
      yLegacy: f.y[i],
      shotDistance: f.d[i],
      shotResult: f.m[i] ? 'Made' : 'Missed',
      shotValue: f.v[i],
      subType: f.subTypes[f.s[i]],
    };
  }
  return shots;
}

export function loadSeason(season: string): Promise<ShotData[]> {
  let shots = seasonShots.get(season);
  if (!shots) {
    shots = getJson<SeasonFile>(`shots/${season}.json`).then(decode);
    // Drop a failed load so the next request retries it.
    shots.catch(() => seasonShots.delete(season));
    seasonShots.set(season, shots);
  }
  return shots;
}

export async function getShots(
  season: string,
  entityId?: string,
  viewMode: 'player' | 'team' | 'league' = 'league',
): Promise<ShotData[]> {
  const shots = await loadSeason(season);
  if (viewMode === 'player' && entityId) return shots.filter(s => s.personId === entityId);
  if (viewMode === 'team' && entityId) return shots.filter(s => s.teamTricode === entityId);
  return shots;
}
