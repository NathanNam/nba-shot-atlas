// Turns the numbers on screen into a one-sentence finding for the headline.
// Each candidate gets a score (how unusual it is, in rough "notable units");
// the highest wins. Names are used instead of pronouns.
import type { Kind, LeagueSeason } from '@/services/staticData';
import { shootingLine, zoneTable, type ShootingLine } from './shotStats';
import type { ShotData } from '@/services/staticData';
import { TEAMS } from './teams';

export interface Subject {
  kind: Kind;
  /** Player full name or team tricode. */
  name: string;
}

interface Phrase {
  /** "Curry", "the Warriors" */
  noun: string;
  /** "Curry's", "the Warriors'" */
  of: string;
  /** Team nicknames take a plural verb: "the Warriors have". */
  plural: boolean;
}

function phrase(s: Subject): Phrase {
  if (s.kind === 'team') {
    const full = TEAMS[s.name] ?? s.name;
    const nick = s.name === 'POR' ? 'Trail Blazers' : full.split(' ').slice(-1)[0];
    const noun = `the ${nick}`;
    return { noun, of: nick.endsWith('s') ? `${noun}'` : `${noun}'s`, plural: true };
  }
  const parts = s.name.trim().split(/\s+/);
  let last = parts[parts.length - 1];
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last) && parts.length > 2) last = `${parts[parts.length - 2]} ${last}`;
  return { noun: last, of: last.endsWith('s') ? `${last}'` : `${last}'s`, plural: false };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const p0 = (v: number) => `${Math.round(v * 100)}%`;
const p1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const pts = (d: number) => `${Math.abs(d * 100).toFixed(1)} points`;
const TENS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** 0.61 -> "six in ten", 0.53 -> "more than half", 0.44 -> "44%" */
function share(v: number): string {
  const tenth = Math.round(v * 10);
  if (tenth >= 1 && tenth <= 9 && Math.abs(v - tenth / 10) <= 0.025) return `${TENS[tenth]} in ten`;
  if (v > 0.5 && v < 0.56) return 'more than half';
  return p0(v);
}

interface Candidate {
  score: number;
  text: string;
}

const best = (cands: (Candidate | null)[], fallback: string) =>
  cands.filter((c): c is Candidate => !!c).sort((a, b) => b.score - a.score)[0]?.text ?? fallback;

/** Headline for one player or team in one season. */
export function seasonHeadline(subject: Subject, season: string, shots: ShotData[], league?: LeagueSeason): string {
  const s = phrase(subject);
  const line = shootingLine(shots);
  if (!league || line.shots < 50) return `${cap(s.noun)} in ${season}: ${line.shots.toLocaleString()} shots.`;
  const zones = zoneTable(shots, league);
  const rim = zones[0], mid = zones[2];
  const c: (Candidate | null)[] = [];

  const d3 = line.threeShare! - league.threeShare;
  c.push({
    score: Math.abs(d3) / 0.1,
    text: d3 >= 0
      ? `${cap(share(line.threeShare!))} of ${s.of} shots in ${season} were threes. The league's rate was ${p0(league.threeShare)}.`
      : `Only ${share(line.threeShare!)} of ${s.of} shots in ${season} were threes, against ${p0(league.threeShare)} league-wide.`,
  });

  const de = line.efgPct! - league.efgPct;
  c.push({
    score: Math.abs(de) / 0.04,
    text: `${cap(s.noun)} shot an effective ${p1(line.efgPct!)} in ${season}, ${pts(de)} ${de >= 0 ? 'better' : 'worse'} than the league.`,
  });

  if (line.threes >= 150) {
    const dp = line.fg3Pct! - league.fg3Pct;
    c.push({
      score: (Math.abs(dp) / 0.035) * Math.min(1, line.threes / 400),
      text: `${cap(s.noun)} made ${p1(line.fg3Pct!)} of ${line.threes.toLocaleString()} threes in ${season}, ${pts(dp)} ${dp >= 0 ? 'above' : 'below'} the league.`,
    });
  }
  if (rim.leagueShare != null) {
    const dr = rim.share - rim.leagueShare;
    c.push({
      score: Math.abs(dr) / 0.1,
      text: `${cap(p0(rim.share))} of ${s.of} shots came at the rim in ${season}; the league average was ${p0(rim.leagueShare)}.`,
    });
  }
  if (mid.leagueShare != null && mid.leagueShare > 0) {
    const ratio = mid.share / mid.leagueShare;
    if (ratio >= 1.6) {
      c.push({
        score: (ratio - 1) / 0.6,
        text: `${cap(s.noun)} took ${p0(mid.share)} of shots from mid-range in ${season}, ${ratio >= 1.95 ? 'twice' : `${ratio.toFixed(1)}×`} the league's rate.`,
      });
    }
  }
  return best(c, `${cap(s.noun)} in ${season}.`);
}

function careerLine(by: Map<string, ShotData[]>, seasons: string[]): ShootingLine {
  return shootingLine(seasons.flatMap(x => by.get(x) ?? []));
}

/** Headline for one player's or team's seasons since 2013-14. */
export function careerHeadline(
  subject: Subject,
  seasons: string[],
  bySeason: Map<string, ShotData[]>,
  league: Record<string, LeagueSeason>,
): string {
  const s = phrase(subject);
  const full = seasons.filter(x => (bySeason.get(x)?.length ?? 0) >= 150);
  if (full.length < 2) return `${cap(s.of)} seasons since 2013-14.`;
  const all = careerLine(bySeason, seasons);
  const lgShare = full.reduce((a, x) => a + league[x].threeShare, 0) / full.length;
  const first = full[0], last = full[full.length - 1];
  const f = shootingLine(bySeason.get(first)!), l = shootingLine(bySeason.get(last)!);
  const c: (Candidate | null)[] = [];

  const d = all.threeShare! - lgShare;
  c.push({
    score: Math.abs(d) / 0.1,
    text: d >= 0
      ? `${cap(share(all.threeShare!))} of ${s.of} shots since ${seasons[0]} were threes. The league, over the same seasons: ${share(lgShare)}.`
      : `Only ${share(all.threeShare!)} of ${s.of} shots since ${seasons[0]} were threes, while the league took ${share(lgShare)}.`,
  });

  const rise = l.threeShare! - f.threeShare!;
  const lgRise = league[last].threeShare - league[first].threeShare;
  if (Math.abs(rise) >= 0.08) {
    c.push({
      score: Math.abs(rise - lgRise) / 0.08,
      text: `${cap(s.of)} three-point rate went from ${p0(f.threeShare!)} in ${first} to ${p0(l.threeShare!)} in ${last}; the league's went from ${p0(league[first].threeShare)} to ${p0(league[last].threeShare)}.`,
    });
  }

  const lgEfg = full.reduce((a, x) => a + league[x].efgPct, 0) / full.length;
  const de = all.efgPct! - lgEfg;
  c.push({
    score: Math.abs(de) / 0.035,
    text: `Since ${seasons[0]}, ${s.noun} ${s.plural ? 'have' : 'has'} shot${de >= 0 ? '' : ' only'} an effective ${p1(all.efgPct!)}, ${pts(de)} ${de >= 0 ? 'above' : 'below'} the league.`,
  });
  return best(c, `${cap(s.of)} seasons since ${seasons[0]}.`);
}

/** Headline comparing two subjects (or one subject in two seasons). */
export function compareHeadline(
  a: { subject: Subject; season: string; shots: ShotData[] },
  b: { subject: Subject; season: string; shots: ShotData[] },
): string {
  const la = shootingLine(a.shots), lb = shootingLine(b.shots);
  if (la.shots < 50 || lb.shots < 50) return '';
  const same = a.subject.name === b.subject.name && a.subject.kind === b.subject.kind;
  const pa = phrase(a.subject), pb = phrase(b.subject);
  const c: Candidate[] = [];
  const d3 = la.threeShare! - lb.threeShare!;
  const de = la.efgPct! - lb.efgPct!;
  if (same) {
    c.push({
      score: Math.abs(d3) / 0.08,
      text: `${cap(pa.of)} three-point rate: ${p0(la.threeShare!)} in ${a.season}, ${p0(lb.threeShare!)} in ${b.season}.`,
    });
    c.push({
      score: Math.abs(de) / 0.03,
      text: `${cap(pa.noun)} shot an effective ${p1(la.efgPct!)} in ${a.season} and ${p1(lb.efgPct!)} in ${b.season}.`,
    });
  } else {
    c.push({
      score: Math.abs(d3) / 0.1,
      text: `${cap(share(la.threeShare!))} of ${pa.of} shots were threes in ${a.season}; for ${pb.noun}, ${share(lb.threeShare!)}.`,
    });
    c.push({
      score: Math.abs(de) / 0.03,
      text: `${cap(pa.noun)} shot an effective ${p1(la.efgPct!)} in ${a.season}, ${pb.noun} ${p1(lb.efgPct!)}.`,
    });
  }
  return best(c, '');
}
