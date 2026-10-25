import { useMemo, useState, type ReactNode } from 'react';
import type { Career, Kind, LeagueSeason, SeasonIndex, ShotData } from '@/services/staticData';
import { useCareer } from '@/hooks/useData';
import { pct, ppDiff, shootingLine, zoneTable, type ShootingLine } from '@/lib/shotStats';
import { compareHeadline, seasonHeadline } from '@/lib/headline';
import { teamName } from '@/lib/teams';
import { Court, DotLegend, HexLegend, type CourtMode } from './Court';
import { TrendChart } from './TrendChart';
import type { Selection } from './EntityPicker';

interface SeasonViewProps {
  kind: Kind;
  selections: Selection[];
  season: string;
  /** Second season to compare one selection against. */
  compareSeason: string | null;
  index: SeasonIndex;
  onOpenSeason: (season: string) => void;
  onOpenCareer: () => void;
}

interface Panel {
  sel: Selection;
  seriesIndex: number;
  season: string;
  career?: Career;
  error?: string;
  shots: ShotData[];
  line: ShootingLine;
  league?: LeagueSeason;
}

const STATS = [
  { key: 'fgPct', label: 'FG%', leagueKey: 'fgPct' },
  { key: 'fg3Pct', label: '3P%', leagueKey: 'fg3Pct' },
  { key: 'efgPct', label: 'eFG%', leagueKey: 'efgPct', hint: 'Effective FG%: a made three counts 1.5 times' },
  { key: 'threeShare', label: '3s share', leagueKey: 'threeShare', hint: 'Share of shots that were threes' },
] as const;

function Delta({ a, b, neutral }: { a: number | null; b: number | null | undefined; neutral?: boolean }) {
  const text = ppDiff(a, b);
  const d = a != null && b != null ? a - b : 0;
  const tone = neutral || Math.abs(d) < 0.005 ? 'text-ink-3' : d > 0 ? 'text-good' : 'text-bad';
  return <span className={`num ${tone}`}>{text} pts vs league</span>;
}

export function SeasonView({ kind, selections, season, compareSeason, index, onOpenSeason, onOpenCareer }: SeasonViewProps) {
  const [mode, setMode] = useState<CourtMode>('hex');
  const c0 = useCareer(kind, selections[0]?.id ?? null);
  const c1 = useCareer(kind, selections[1]?.id ?? null);

  const panels: Panel[] = useMemo(() => {
    const make = (sel: Selection, seriesIndex: number, s: string, c: typeof c0): Panel => {
      const shots = c.data?.bySeason.get(s) ?? [];
      return { sel, seriesIndex, season: s, career: c.data, error: c.error, shots, line: shootingLine(shots), league: index.league[s] };
    };
    if (selections.length === 0) return [];
    if (selections.length > 1) return [make(selections[0], 0, season, c0), make(selections[1], 1, season, c1)];
    const p = [make(selections[0], 0, season, c0)];
    if (compareSeason && compareSeason !== season) p.push(make(selections[0], 1, compareSeason, c0));
    return p;
  }, [selections, season, compareSeason, c0, c1, index]);

  if (selections.length === 0) {
    return <Empty>Pick a {kind} above to see where their shots came from.</Empty>;
  }
  const loading = panels.some(p => !p.career && !p.error);
  const errors = panels.filter(p => p.error);
  if (errors.length) return <Empty tone="bad">{errors[0].error}</Empty>;
  if (loading) return <Empty pulse>Loading…</Empty>;

  const displayName = (sel: Selection) => (kind === 'team' ? teamName(sel.id) : sel.name);
  const subject = (sel: Selection) => ({ kind, name: kind === 'team' ? sel.id : sel.name });
  const empty = panels.filter(p => p.shots.length === 0);
  const ready = panels.filter(p => p.shots.length > 0);
  const two = panels.length > 1;
  const sameSubject = two && panels[0].sel.id === panels[1].sel.id;

  const headline = ready.length === 0
    ? ''
    : two && ready.length === 2
      ? compareHeadline(
          { subject: subject(ready[0].sel), season: ready[0].season, shots: ready[0].shots },
          { subject: subject(ready[1].sel), season: ready[1].season, shots: ready[1].shots },
        ) || seasonHeadline(subject(ready[0].sel), ready[0].season, ready[0].shots, ready[0].league)
      : seasonHeadline(subject(ready[0].sel), ready[0].season, ready[0].shots, ready[0].league);

  const team0 = kind === 'player' ? panels[0].career?.teamsBySeason.get(panels[0].season)?.map(teamName).join(' / ') : null;
  const kicker = two
    ? sameSubject
      ? `${displayName(panels[0].sel)} · ${panels[0].season} vs ${panels[1].season}`
      : `${displayName(panels[0].sel)} vs ${displayName(panels[1].sel)} · ${season}`
    : [displayName(panels[0].sel), team0, season].filter(Boolean).join(' · ');
  const label = (p: Panel) => (sameSubject ? p.season : displayName(p.sel));
  const color = (p: Panel) => `rgb(var(--series-${p.seriesIndex + 1}))`;
  const leaguePps = index.league[season]?.pointsPerShot ?? 1.05;

  // Season-by-season share of threes for the people on screen (small trend at the bottom).
  const seasonsAsc = [...index.seasons].reverse();
  const trendSubjects = sameSubject ? [panels[0]] : panels;

  return (
    <article className="space-y-8">
      <header className="max-w-4xl">
        <p className="kicker">{kicker}</p>
        {headline && <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] leading-[1.12] mt-2 text-balance">{headline}</h1>}
        <p className="font-body text-ink-2 text-base sm:text-lg mt-3">
          Regular-season field-goal attempts, compared with the league average for the same season.
        </p>
      </header>

      {empty.map(p => (
        <Empty key={`${p.sel.id}-${p.season}`}>
          {displayName(p.sel)} didn't take a shot in {p.season}.{' '}
          {p.career && p.career.seasons.length > 0 && (
            <>Seasons with shots: {p.career.seasons[0]} to {p.career.seasons[p.career.seasons.length - 1]}.</>
          )}
        </Empty>
      ))}

      {ready.length > 0 && (
        <>
          {/* The numbers */}
          <section className="section">
            {ready.length === 1 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
                {STATS.map(s => (
                  <div key={s.key} title={'hint' in s ? s.hint : undefined}>
                    <div className="label">{s.label}</div>
                    <div className="font-display num text-4xl sm:text-[2.75rem] leading-tight">{pct(ready[0].line[s.key])}</div>
                    <div className="font-ui text-xs mt-0.5">
                      <Delta a={ready[0].line[s.key]} b={ready[0].league?.[s.leagueKey]} neutral={s.key === 'threeShare'} />
                    </div>
                  </div>
                ))}
                <div>
                  <div className="label">Shots</div>
                  <div className="font-display num text-4xl sm:text-[2.75rem] leading-tight">{ready[0].line.shots.toLocaleString()}</div>
                  <div className="font-ui text-xs text-ink-3 mt-0.5">{ready[0].line.made.toLocaleString()} made</div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-ui text-sm num">
                  <thead>
                    <tr className="text-left">
                      <th className="label py-2 pr-4 font-semibold" />
                      {STATS.map(s => <th key={s.key} className="label py-2 pr-4 text-right" title={'hint' in s ? s.hint : undefined}>{s.label}</th>)}
                      <th className="label py-2 text-right">Shots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ready.map(p => (
                      <tr key={`${p.sel.id}-${p.season}`} className="border-t border-rule-soft">
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-2 font-semibold" style={{ color: color(p) }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(p) }} />
                            {label(p)}
                          </span>
                        </td>
                        {STATS.map(s => (
                          <td key={s.key} className="py-3 pr-4 text-right">
                            <div className="font-display text-2xl">{pct(p.line[s.key])}</div>
                            <div className="text-xs"><Delta a={p.line[s.key]} b={p.league?.[s.leagueKey]} neutral={s.key === 'threeShare'} /></div>
                          </td>
                        ))}
                        <td className="py-3 text-right font-display text-2xl">{p.line.shots.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Where the shots came from */}
          <section className="section">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-2xl">Where the shots came from</h2>
                <p className="font-body text-ink-2">
                  {mode === 'hex' ? 'Each hexagon is a spot on the floor.' : 'Every shot of the season.'}
                </p>
              </div>
              <div className="seg" role="group" aria-label="Court view">
                <button aria-pressed={mode === 'hex'} onClick={() => setMode('hex')}>Hot spots</button>
                <button aria-pressed={mode === 'dots'} onClick={() => setMode('dots')}>Every shot</button>
              </div>
            </div>
            <div className={`grid gap-6 ${ready.length > 1 ? 'md:grid-cols-2' : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'}`}>
              {ready.map(p => (
                <figure key={`${p.sel.id}-${p.season}`}>
                  <Court shots={p.shots} mode={mode} leaguePps={p.league?.pointsPerShot ?? leaguePps} hexRadius={15} minShots={4} className="w-full h-auto" label={`${label(p)} shot chart, ${p.line.shots} shots`} />
                  <figcaption className="font-ui text-xs text-ink-2 mt-2">
                    {ready.length > 1 && <b className="font-semibold" style={{ color: color(p) }}>{label(p)} · </b>}
                    {p.line.shots.toLocaleString()} shots in {p.season}
                  </figcaption>
                </figure>
              ))}
              {ready.length === 1 && <ZoneTable panels={ready} label={label} color={color} />}
            </div>
            <div className="mt-4">{mode === 'hex' ? <HexLegend leaguePps={leaguePps} /> : <DotLegend />}</div>
            {ready.length > 1 && <div className="mt-6"><ZoneTable panels={ready} label={label} color={color} /></div>}
          </section>

          {/* Season by season */}
          <section className="section">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-2">
              <div>
                <h2 className="font-display text-2xl">Share of shots that were threes</h2>
                <p className="font-body text-ink-2">Every season since 2013-14. Dashed: league average. Click a season to open it.</p>
              </div>
              <button className="font-ui text-sm font-semibold text-brand hover:underline self-start sm:self-auto" onClick={onOpenCareer}>
                Full career view →
              </button>
            </div>
            <TrendChart
              seasons={seasonsAsc}
              format={v => `${Math.round(v * 100)}%`}
              onSelect={onOpenSeason}
              height={240}
              series={[
                ...trendSubjects.map(p => ({
                  name: kind === 'team' ? p.sel.id : p.sel.name,
                  color: color(p),
                  values: seasonsAsc.map(s => shootingLine(p.career?.bySeason.get(s) ?? []).threeShare),
                  counts: seasonsAsc.map(s => p.career?.bySeason.get(s)?.length ?? 0),
                })),
                { name: 'League', color: 'rgb(var(--league))', dashed: true, values: seasonsAsc.map(s => index.league[s]?.threeShare ?? null) },
              ]}
            />
          </section>
        </>
      )}
    </article>
  );
}

function ZoneTable({ panels, label, color }: { panels: Panel[]; label: (p: Panel) => string; color: (p: Panel) => string }) {
  const tables = panels.map(p => zoneTable(p.shots, p.league));
  const one = panels.length === 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-ui text-sm num">
        <caption className="text-left font-display text-lg mb-2">By zone</caption>
        <thead>
          {!one && (
            <tr>
              <th />
              {panels.map(p => (
                <th key={`${p.sel.id}-${p.season}`} colSpan={3} className="label text-right pt-2 pr-3" style={{ color: color(p) }}>
                  {label(p)}
                </th>
              ))}
            </tr>
          )}
          <tr className="text-ink-3 text-xs">
            <th className="text-left font-normal py-2 pr-3">Zone</th>
            {panels.map(p => (
              <FragmentHead key={`${p.sel.id}-${p.season}`} />
            ))}
          </tr>
        </thead>
        <tbody>
          {tables[0].map((row, i) => (
            <tr key={row.zone} className="border-t border-rule-soft">
              <td className="py-2 pr-3 whitespace-nowrap">{row.zone}</td>
              {tables.map((t, k) => {
                const r = t[i];
                const d = r.fgPct != null && r.leagueFgPct != null ? r.fgPct - r.leagueFgPct : 0;
                const tone = r.shots < 10 || Math.abs(d) < 0.005 ? 'text-ink-3' : d > 0 ? 'text-good' : 'text-bad';
                return (
                  <FragmentCells key={k}>
                    <td className="py-2 pr-3 text-right" title={r.leagueShare != null ? `League: ${pct(r.leagueShare, 0)} of shots` : undefined}>
                      {pct(r.share, 0)}
                    </td>
                    <td className="py-2 pr-3 text-right">{r.shots ? pct(r.fgPct, 1) : '–'}</td>
                    <td className={`py-2 pr-3 text-right text-xs ${tone}`}>{r.shots ? ppDiff(r.fgPct, r.leagueFgPct) : ''}</td>
                  </FragmentCells>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-ui text-xs text-ink-3 mt-2">Share of shots · FG% · difference from the league's FG% in that zone, in points.</p>
    </div>
  );
}

function FragmentHead() {
  return (
    <>
      <th className="text-right font-normal pr-3">Shots</th>
      <th className="text-right font-normal pr-3">FG%</th>
      <th className="text-right font-normal pr-3">vs lg</th>
    </>
  );
}

function FragmentCells({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Empty({ children, tone, pulse }: { children: ReactNode; tone?: 'bad'; pulse?: boolean }) {
  return (
    <div className={`section font-body text-lg ${tone === 'bad' ? 'text-bad' : 'text-ink-2'} ${pulse ? 'animate-pulse' : ''}`}>
      {children}
    </div>
  );
}
