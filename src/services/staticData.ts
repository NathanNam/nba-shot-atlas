// Static data built by scripts/build_data.py into public/data/:
//   seasons.json          season list, default season, league averages per season
//   players.json          [personId, name, season start years] for every shooter
//   players/<id>.json     one player's shots over all seasons
//   teams/<code>.json     one team's shots over all seasons
// Each file is fetched once and decoded once.

export interface ShotData {
  personId: string;
  teamTricode: string;
  xLegacy: number;
  yLegacy: number;
  shotDistance: number;
  shotResult: 'Made' | 'Missed';
  shotValue: number;
  subType?: string;
}

export interface LeagueSeason {
  shots: number;
  fgPct: number;
  fg3Pct: number;
  threeShare: number;
  efgPct: number;
  pointsPerShot: number;
  teams: number;
  /** [attempts, made] per zone, in SeasonIndex.zones order. */
  zones: [number, number][];
}

export interface SeasonIndex {
  /** Newest first. */
  seasons: string[];
  default: string;
  zones: string[];
  league: Record<string, LeagueSeason>;
}

export interface PlayerInfo {
  id: string;
  name: string;
  /** Season labels ('2025-26') with at least one shot, oldest first. */
  seasons: string[];
}

export type Kind = 'player' | 'team';

export interface Career {
  id: string;
  /** Oldest first: the seasons with at least one shot. */
  seasons: string[];
  bySeason: Map<string, ShotData[]>;
  /** Teams played for, per season (players only). */
  teamsBySeason: Map<string, string[]>;
  all: ShotData[];
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

const BASE = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

/** Cache a promise per key; a failed load is dropped so the next call retries. */
function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = load();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

let seasonIndex: Promise<SeasonIndex> | null = null;
let players: Promise<PlayerInfo[]> | null = null;
const careers = new Map<string, Promise<Career>>();

export const seasonLabel = (startYear: number) => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

export function loadSeasonIndex(): Promise<SeasonIndex> {
  seasonIndex ??= getJson<SeasonIndex>('seasons.json');
  seasonIndex.catch(() => (seasonIndex = null));
  return seasonIndex;
}

export function loadPlayers(): Promise<PlayerInfo[]> {
  players ??= getJson<[number, string, number[]][]>('players.json').then(rows =>
    rows.map(([id, name, years]) => ({ id: String(id), name, seasons: years.map(seasonLabel) }))
  );
  players.catch(() => (players = null));
  return players;
}

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
export function loadCareer(kind: Kind, id: string): Promise<Career> {
  return cached(careers, `${kind}/${id}`, () => getJson<CareerFile>(`${kind}s/${id}.json`).then(decodeCareer));
}
