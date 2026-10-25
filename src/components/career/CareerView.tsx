import { useEffect, useMemo, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAvailablePlayers } from '@/hooks/useAvailablePlayers';
import { loadCareer, loadSeasonIndex, type Career, type SeasonIndex } from '@/services/staticData';
import { shootingLine, pct, type ShootingLine } from '@/lib/shotStats';
import { Court, DotLegend, HexLegend, type CourtMode } from './Court';

type Kind = 'player' | 'team';

interface CareerViewProps {
  entities: string[];
  viewMode: Kind;
  /** Open one season in the normal (single-season) view. */
  onOpenSeason: (season: string) => void;
}

const COLORS = ['hsl(var(--accent))', 'hsl(195 85% 55%)'];
const LEAGUE_COLOR = 'hsl(var(--muted-foreground))';

const METRICS = [
  { key: 'threeShare', label: 'Share of shots that were 3s', short: '3s share', percent: true },
  { key: 'fg3Pct', label: '3-point %', short: '3P%', percent: true },
  { key: 'fgPct', label: 'Field-goal %', short: 'FG%', percent: true },
  { key: 'efgPct', label: 'Effective FG % (a made 3 counts 1.5×)', short: 'eFG%', percent: true },
  { key: 'pointsPerShot', label: 'Points per shot', short: 'Pts/shot', percent: false },
  { key: 'shots', label: 'Shots taken', short: 'Shots', percent: false },
] as const;
type MetricKey = (typeof METRICS)[number]['key'];

interface Entity {
  name: string;
  kind: Kind;
  id?: string;
  career?: Career;
  lines?: Map<string, ShootingLine>;
  error?: string;
}

function useCareers(entities: string[], kind: Kind): Entity[] {
  const { players, loading } = useAvailablePlayers();
  const [loaded, setLoaded] = useState<Record<string, Career | string>>({});

  const resolved = useMemo(
    () =>
      entities.map(name => ({
        name,
        kind,
        id: kind === 'team' ? name : players.find(p => p.name === name)?.id,
      })),
    [entities, kind, players]
  );

  useEffect(() => {
    let ignore = false;
    for (const e of resolved) {
      if (!e.id) continue;
      const key = `${kind}/${e.id}`;
      loadCareer(kind, e.id).then(
        career => !ignore && setLoaded(prev => ({ ...prev, [key]: career })),
        err => !ignore && setLoaded(prev => ({ ...prev, [key]: String(err?.message ?? err) }))
      );
    }
    return () => {
      ignore = true;
    };
  }, [resolved, kind]);

  return useMemo(
    () =>
      resolved.map(e => {
        const got = e.id ? loaded[`${kind}/${e.id}`] : undefined;
        if (!e.id) return { ...e, error: loading ? undefined : `No data for ${e.name}` };
        if (typeof got === 'string') return { ...e, error: got };
        if (!got) return e;
        const lines = new Map([...got.bySeason].map(([season, shots]) => [season, shootingLine(shots)]));
        return { ...e, career: got, lines };
      }),
    [resolved, loaded, kind, loading]
  );
}

function fmt(metric: MetricKey, v: number | null | undefined): string {
  if (v == null) return '–';
  if (metric === 'shots') return Math.round(v).toLocaleString();
  if (metric === 'pointsPerShot') return v.toFixed(2);
  return pct(v);
}

export function CareerView({ entities, viewMode, onOpenSeason }: CareerViewProps) {
  const [index, setIndex] = useState<SeasonIndex | null>(null);
  const [metric, setMetric] = useState<MetricKey>('threeShare');
  const [courtMode, setCourtMode] = useState<CourtMode>('hex');
  const careers = useCareers(entities, viewMode);

  useEffect(() => {
    loadSeasonIndex().then(setIndex);
  }, []);

  const seasons = useMemo(() => (index ? [...index.seasons].reverse() : []), [index]);
  const meta = METRICS.find(m => m.key === metric)!;

  const rows = useMemo(
    () =>
      seasons.map(season => {
        const row: Record<string, string | number | null> = { season };
        const lg = index?.league[season];
        row.league =
          metric === 'shots'
            ? viewMode === 'team' && lg ? lg.shots / 30 : null
            : lg ? lg[metric] : null;
        careers.forEach((e, i) => {
          const line = e.lines?.get(season);
          row[`e${i}`] = line ? line[metric] : null;
          row[`n${i}`] = line?.shots ?? 0;
        });
        return row;
      }),
    [seasons, index, careers, metric, viewMode]
  );

  // League points per shot over the seasons shown, for the court colours.
  const leaguePps = useMemo(() => {
    const vals = seasons.map(s => index?.league[s]?.pointsPerShot).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1.05;
  }, [seasons, index]);

  if (entities.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Pick a {viewMode} on the left to see their seasons since 2013-14.
      </Card>
    );
  }

  const ready = careers.filter(e => e.career);
  const title = careers.map(e => e.name).join(' vs ');

  return (
    <div className="space-y-6">
      {careers.filter(e => e.error).map(e => (
        <Card key={e.name} className="p-4 text-destructive">{e.error}</Card>
      ))}

      {/* 1 + 4: trend over the seasons, one line per selection plus the league */}
      <Card className="p-4 sm:p-6 bg-card border-border shadow-card">
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <h3 className="text-fluid-heading text-foreground">{title}: season by season</h3>
            <p className="text-sm text-muted-foreground">
              {meta.label}. Dashed line: league average. Data starts in 2013-14; click a season to open it.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Statistic">
            {METRICS.map(m => (
              <Button
                key={m.key}
                size="sm"
                variant={metric === m.key ? 'default' : 'secondary'}
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
              >
                {m.short}
              </Button>
            ))}
          </div>
        </div>
        {ready.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground animate-pulse">Loading seasons…</div>
        ) : (
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={rows}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                onClick={(state: { activeLabel?: string | number }) => {
                  if (state?.activeLabel) onOpenSeason(String(state.activeLabel));
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="season" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  width={48}
                  domain={metric === 'shots' ? [0, 'auto'] : ['auto', 'auto']}
                  tickFormatter={v => (meta.percent ? `${Math.round(v * 100)}%` : metric === 'shots' ? Number(v).toLocaleString() : Number(v).toFixed(2))}
                />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value, name, item) => {
                    const i = String(item?.dataKey ?? '').match(/^e(\d)$/)?.[1];
                    const shots = i != null ? (item?.payload as Record<string, number>)[`n${i}`] : null;
                    const v = fmt(metric, value as number);
                    return [metric !== 'shots' && shots != null ? `${v} (${shots.toLocaleString()} shots)` : v, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {metric === 'shots'
                  ? careers.map((e, i) => (
                      <Bar key={e.name} dataKey={`e${i}`} name={e.name} fill={COLORS[i]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    ))
                  : careers.map((e, i) => (
                      <Line
                        key={e.name}
                        dataKey={`e${i}`}
                        name={e.name}
                        stroke={COLORS[i]}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                {rows.some(r => r.league != null) && (
                  <Line
                    dataKey="league"
                    name={viewMode === 'team' && metric === 'shots' ? 'League (per team)' : 'League'}
                    stroke={LEAGUE_COLOR}
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Season table per selection */}
      {ready.map((e, i) => (
        <CareerTable key={e.name} entity={e} color={COLORS[i]} index={index} onOpenSeason={onOpenSeason} />
      ))}

      {/* 2: one small court per season */}
      {ready.map((e, i) => (
        <Card key={`grid-${e.name}`} className="p-4 sm:p-6 bg-card border-border shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
            <div>
              <h3 className="text-fluid-heading" style={{ color: COLORS[i] }}>{e.name}: where the shots came from</h3>
              <p className="text-sm text-muted-foreground">One court per season. Click a court to open that season.</p>
            </div>
            <HexLegend leaguePps={leaguePps} />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            {e.career!.seasons.map(season => {
              const line = e.lines!.get(season)!;
              const pps = index?.league[season]?.pointsPerShot ?? leaguePps;
              return (
                <button
                  key={season}
                  onClick={() => onOpenSeason(season)}
                  className="text-left rounded-lg border border-border bg-secondary/20 p-2 hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${e.name} ${season}: ${line.shots} shots, ${pct(line.threeShare, 0)} threes. Open this season.`}
                >
                  <Court shots={e.career!.bySeason.get(season)!} leaguePps={pps} hexRadius={22} minShots={3} className="w-full h-auto" />
                  <div className="mt-1.5 text-sm font-semibold text-foreground">{season}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {line.shots.toLocaleString()} shots · {pct(line.threeShare, 0)} 3s
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      {/* 3: every shot since 2013-14 on one court */}
      {ready.length > 0 && (
        <Card className="p-4 sm:p-6 bg-card border-border shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-fluid-heading text-foreground">Career shot chart</h3>
              <p className="text-sm text-muted-foreground">Every shot since 2013-14 on one court.</p>
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Court view">
              {(['hex', 'dots'] as const).map(m => (
                <Button key={m} size="sm" variant={courtMode === m ? 'default' : 'secondary'} aria-pressed={courtMode === m} onClick={() => setCourtMode(m)}>
                  {m === 'hex' ? 'Hot spots' : 'Every shot'}
                </Button>
              ))}
            </div>
          </div>
          <div className={`grid gap-4 ${ready.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {ready.map((e, i) => {
              const line = shootingLine(e.career!.all);
              return (
                <figure key={e.name} className={ready.length === 1 ? 'max-w-2xl mx-auto w-full' : ''}>
                  <Court
                    shots={e.career!.all}
                    mode={courtMode}
                    leaguePps={leaguePps}
                    hexRadius={14}
                    minShots={8}
                    className="w-full h-auto"
                    label={`${e.name}, ${line.shots} shots since 2013-14`}
                  />
                  <figcaption className="mt-2 text-sm text-muted-foreground tabular-nums">
                    <span className="font-semibold" style={{ color: COLORS[i] }}>{e.name}</span>{' '}
                    {line.shots.toLocaleString()} shots · FG {pct(line.fgPct)} · 3P {pct(line.fg3Pct)} · {pct(line.threeShare, 0)} of shots were 3s
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <div className="mt-4">{courtMode === 'hex' ? <HexLegend leaguePps={leaguePps} /> : <DotLegend />}</div>
        </Card>
      )}
    </div>
  );
}

function CareerTable({
  entity, color, index, onOpenSeason,
}: { entity: Entity; color: string; index: SeasonIndex | null; onOpenSeason: (s: string) => void }) {
  const career = entity.career!;
  const total = shootingLine(career.all);
  return (
    <Card className="p-4 sm:p-6 bg-card border-border shadow-card">
      <h3 className="text-fluid-heading mb-3" style={{ color }}>{entity.name}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-b border-border">
              <th className="text-left font-medium py-2 pr-3">Season</th>
              {entity.kind === 'player' && <th className="text-left font-medium pr-3">Team</th>}
              <th className="text-right font-medium pr-3">Shots</th>
              <th className="text-right font-medium pr-3">FG%</th>
              <th className="text-right font-medium pr-3">3PA</th>
              <th className="text-right font-medium pr-3">3P%</th>
              <th className="text-right font-medium pr-3">3s share</th>
              <th className="text-right font-medium pr-3">League 3s</th>
              <th className="text-right font-medium">eFG%</th>
            </tr>
          </thead>
          <tbody>
            {career.seasons.map(season => {
              const l = shootingLine(career.bySeason.get(season)!);
              return (
                <tr key={season} className="border-b border-border/50 hover:bg-secondary/40">
                  <td className="py-1.5 pr-3">
                    <button className="underline-offset-2 hover:underline" onClick={() => onOpenSeason(season)}>{season}</button>
                  </td>
                  {entity.kind === 'player' && (
                    <td className="pr-3 text-muted-foreground">{career.teamsBySeason.get(season)?.join(', ')}</td>
                  )}
                  <td className="text-right pr-3">{l.shots.toLocaleString()}</td>
                  <td className="text-right pr-3">{pct(l.fgPct)}</td>
                  <td className="text-right pr-3">{l.threes.toLocaleString()}</td>
                  <td className="text-right pr-3">{pct(l.fg3Pct)}</td>
                  <td className="text-right pr-3 font-semibold" style={{ color }}>{pct(l.threeShare, 0)}</td>
                  <td className="text-right pr-3 text-muted-foreground">{pct(index?.league[season]?.threeShare, 0)}</td>
                  <td className="text-right">{pct(l.efgPct)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-3">Total</td>
              {entity.kind === 'player' && <td />}
              <td className="text-right pr-3">{total.shots.toLocaleString()}</td>
              <td className="text-right pr-3">{pct(total.fgPct)}</td>
              <td className="text-right pr-3">{total.threes.toLocaleString()}</td>
              <td className="text-right pr-3">{pct(total.fg3Pct)}</td>
              <td className="text-right pr-3" style={{ color }}>{pct(total.threeShare, 0)}</td>
              <td />
              <td className="text-right">{pct(total.efgPct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
