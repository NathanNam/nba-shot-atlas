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

export interface LeagueSeason {
  shots: number;
  fgPct: number;
  fg3Pct: number;
  threeShare: number;
  efgPct: number;
  pointsPerShot: number;
}

export interface SeasonIndex {
  /** Newest first. */
  seasons: string[];
  default: string;
  league: Record<string, LeagueSeason>;
}

interface CareerFile {
  id: string;
  count: number;
  seasons: string[];
  teams?: string[];
  subTypes: string[];
  n: number[];
  t?: number[];
  x: number[];
  y: number[];
  d: number[];
  m: number[];
  v: number[];
  s: number[];
}

export interface Career {
  id: string;
  /** Oldest first: the seasons with at least one shot. */
  seasons: string[];
  bySeason: Map<string, ShotData[]>;
  /** Teams played for, per season (players only). */
  teamsBySeason: Map<string, string[]>;
  all: ShotData[];
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

const careers = new Map<string, Promise<Career>>();

function decodeCareer(f: CareerFile): Career {
  const bySeason = new Map<string, ShotData[]>(f.seasons.map(season => [season, []]));
  const teamSets = new Map<string, Set<string>>();
  const all: ShotData[] = new Array(f.count);
  for (let i = 0; i < f.count; i++) {
    const season = f.seasons[f.n[i]];
    const team = f.t && f.teams ? f.teams[f.t[i]] : f.id;
    const shot: ShotData = {
      personId: f.t ? f.id : '',
      teamTricode: team,
      xLegacy: f.x[i],
      yLegacy: f.y[i],
      shotDistance: f.d[i],
      shotResult: f.m[i] ? 'Made' : 'Missed',
      shotValue: f.v[i],
      subType: f.subTypes[f.s[i]],
    };
    all[i] = shot;
    bySeason.get(season)!.push(shot);
    if (f.t) {
      let set = teamSets.get(season);
      if (!set) teamSets.set(season, (set = new Set()));
      set.add(team);
    }
  }
  const teamsBySeason = new Map([...teamSets].map(([season, set]) => [season, [...set]]));
  return { id: f.id, seasons: f.seasons, bySeason, teamsBySeason, all };
}

/** Every shot of one player (by personId) or team (by tricode) since 2013-14. */
export function loadCareer(kind: 'player' | 'team', id: string): Promise<Career> {
  const key = `${kind}/${id}`;
  let career = careers.get(key);
  if (!career) {
    career = getJson<CareerFile>(`${kind}s/${id}.json`).then(decodeCareer);
    career.catch(() => careers.delete(key));
    careers.set(key, career);
  }
  return career;
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
