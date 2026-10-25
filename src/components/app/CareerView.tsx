import { useMemo, useState } from 'react';
import type { Career, Kind, SeasonIndex } from '@/services/staticData';
import { useCareer } from '@/hooks/useData';
import { pct, shootingLine } from '@/lib/shotStats';
import { careerHeadline } from '@/lib/headline';
import { teamName } from '@/lib/teams';
import { Court, DotLegend, HexLegend, type CourtMode } from './Court';
import { TrendChart } from './TrendChart';
import { Empty } from './SeasonView';
import type { Selection } from './EntityPicker';

interface CareerViewProps {
  kind: Kind;
  selections: Selection[];
  index: SeasonIndex;
  onOpenSeason: (season: string) => void;
}

const METRICS = [
  { key: 'threeShare', label: '3s share', title: 'Share of shots that were threes', percent: true },
  { key: 'fg3Pct', label: '3P%', title: 'Three-point percentage', percent: true },
  { key: 'fgPct', label: 'FG%', title: 'Field-goal percentage', percent: true },
  { key: 'efgPct', label: 'eFG%', title: 'Effective field-goal percentage (a made three counts 1.5 times)', percent: true },
  { key: 'pointsPerShot', label: 'Pts/shot', title: 'Points per shot', percent: false },
  { key: 'shots', label: 'Shots', title: 'Shots taken', percent: false },
] as const;
type MetricKey = (typeof METRICS)[number]['key'];

interface Entity {
  sel: Selection;
  color: string;
  career: Career;
}

export function CareerView({ kind, selections, index, onOpenSeason }: CareerViewProps) {
  const [metric, setMetric] = useState<MetricKey>('threeShare');
  const [mode, setMode] = useState<CourtMode>('hex');
  const c0 = useCareer(kind, selections[0]?.id ?? null);
  const c1 = useCareer(kind, selections[1]?.id ?? null);
  const seasons = useMemo(() => [...index.seasons].reverse(), [index]);
  const meta = METRICS.find(m => m.key === metric)!;

  const loads = [c0, c1].slice(0, selections.length);
  const entities: Entity[] = loads
    .map((c, i) => (c.data ? { sel: selections[i], color: `rgb(var(--series-${i + 1}))`, career: c.data } : null))
    .filter((e): e is Entity => !!e);

  if (selections.length === 0) return <Empty>Pick a {kind} above to see their seasons since 2013-14.</Empty>;
  const failed = loads.find(c => c.error);
  if (failed) return <Empty tone="bad">{failed.error}</Empty>;
  if (entities.length < selections.length) return <Empty pulse>Loading…</Empty>;

  const name = (e: Entity) => (kind === 'team' ? teamName(e.sel.id) : e.sel.name);
  const subject = (e: Entity) => ({ kind, name: kind === 'team' ? e.sel.id : e.sel.name });
  const leaguePps = seasons.reduce((a, s) => a + (index.league[s]?.pointsPerShot ?? 0), 0) / seasons.length;
  const first = entities[0];
  const headline = careerHeadline(subject(first), first.career.seasons, first.career.bySeason, index.league);
  const kicker = entities.length > 1 ? `${name(entities[0])} vs ${name(entities[1])} · since 2013-14` : `${name(first)} · since 2013-14`;

  const value = (e: Entity, s: string) => {
    const shots = e.career.bySeason.get(s);
    if (!shots?.length) return null;
    return metric === 'shots' ? shots.length : shootingLine(shots)[metric];
  };
  const leagueValue = (s: string) => {
    const l = index.league[s];
    if (!l) return null;
    return metric === 'shots' ? (kind === 'team' ? l.shots / l.teams : null) : l[metric];
  };
  const format = (v: number) =>
    meta.percent ? `${(v * 100).toFixed(1)}%` : metric === 'shots' ? Math.round(v).toLocaleString() : v.toFixed(2);
  const tick = (v: number) => (meta.percent ? `${Math.round(v * 100)}%` : metric === 'shots' ? Math.round(v).toLocaleString() : v.toFixed(2));

  return (
    <article className="space-y-8">
      <header className="max-w-4xl">
        <p className="kicker">{kicker}</p>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] leading-[1.12] mt-2 text-balance">{headline}</h1>
        <p className="font-body text-ink-2 text-base sm:text-lg mt-3">
          Every regular season with at least one shot. The data starts in 2013-14, so earlier seasons aren't included.
        </p>
      </header>

      {/* Trend, one line per selection plus the league */}
      <section className="section">
        <div className="flex flex-col gap-3 mb-3">
          <div>
            <h2 className="font-display text-2xl">{meta.title}, by season</h2>
            <p className="font-body text-ink-2">
              {metric === 'shots' && kind === 'player' ? 'Shots taken each season.' : 'Dashed: league average.'} Click a season to open it.
            </p>
          </div>
          <div className="seg flex-wrap" role="group" aria-label="Statistic">
            {METRICS.map(m => (
              <button key={m.key} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)} title={m.title}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart
          seasons={seasons}
          format={format}
          tickFormat={tick}
          zero={metric === 'shots'}
          onSelect={onOpenSeason}
          height={300}
          series={[
            ...entities.map(e => ({
              name: kind === 'team' ? e.sel.id : e.sel.name,
              color: e.color,
              values: seasons.map(s => value(e, s)),
              counts: seasons.map(s => e.career.bySeason.get(s)?.length ?? 0),
            })),
            ...(seasons.some(s => leagueValue(s) != null)
              ? [{ name: kind === 'team' && metric === 'shots' ? 'League, per team' : 'League', color: 'rgb(var(--league))', dashed: true, values: seasons.map(leagueValue) }]
              : []),
          ]}
        />
      </section>

      {/* Season table per selection */}
      {entities.map(e => (
        <CareerTable key={e.sel.id} entity={e} name={name(e)} kind={kind} index={index} onOpenSeason={onOpenSeason} />
      ))}

      {/* One small court per season */}
      {entities.map(e => (
        <section key={`grid-${e.sel.id}`} className="section">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-2xl" style={entities.length > 1 ? { color: e.color } : undefined}>
                {entities.length > 1 ? `${name(e)}: ` : ''}Where the shots came from, season by season
              </h2>
              <p className="font-body text-ink-2">One court per season. Click a court to open that season.</p>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-3 gap-y-5">
            {e.career.seasons.map(s => {
              const line = shootingLine(e.career.bySeason.get(s)!);
              return (
                <button
                  key={s}
                  onClick={() => onOpenSeason(s)}
                  className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  aria-label={`${name(e)} ${s}: ${line.shots} shots, ${pct(line.threeShare, 0)} threes. Open this season.`}
                >
                  <Court
                    shots={e.career.bySeason.get(s)!}
                    leaguePps={index.league[s]?.pointsPerShot ?? leaguePps}
                    hexRadius={22}
                    minShots={3}
                    tooltips={false}
                    className="w-full h-auto ring-1 ring-transparent group-hover:ring-ink-3"
                  />
                  <div className="mt-1.5 font-ui text-sm font-semibold">{s}</div>
                  <div className="font-ui text-xs text-ink-2 num">
                    {line.shots.toLocaleString()} shots · {pct(line.threeShare, 0)} threes
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4"><HexLegend leaguePps={leaguePps} /></div>
        </section>
      ))}

      {/* Every shot since 2013-14 on one court */}
      <section className="section">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-2xl">Every shot since 2013-14</h2>
            <p className="font-body text-ink-2">All seasons on one court.</p>
          </div>
          <div className="seg" role="group" aria-label="Court view">
            <button aria-pressed={mode === 'hex'} onClick={() => setMode('hex')}>Hot spots</button>
            <button aria-pressed={mode === 'dots'} onClick={() => setMode('dots')}>Every shot</button>
          </div>
        </div>
        <div className={`grid gap-6 ${entities.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {entities.map(e => {
            const line = shootingLine(e.career.all);
            return (
              <figure key={e.sel.id} className={entities.length === 1 ? 'max-w-3xl' : ''}>
                <Court shots={e.career.all} mode={mode} leaguePps={leaguePps} hexRadius={13} minShots={8} className="w-full h-auto" label={`${name(e)}, ${line.shots} shots since 2013-14`} />
                <figcaption className="font-ui text-xs text-ink-2 mt-2 num">
                  <b className="font-semibold" style={{ color: e.color }}>{name(e)}</b> · {line.shots.toLocaleString()} shots · FG {pct(line.fgPct)} · 3P {pct(line.fg3Pct)} · {pct(line.threeShare, 0)} were threes
                </figcaption>
              </figure>
            );
          })}
        </div>
        <div className="mt-4">{mode === 'hex' ? <HexLegend leaguePps={leaguePps} /> : <DotLegend />}</div>
      </section>
    </article>
  );
}

function CareerTable({
  entity, name, kind, index, onOpenSeason,
}: { entity: Entity; name: string; kind: Kind; index: SeasonIndex; onOpenSeason: (s: string) => void }) {
  const career = entity.career;
  const total = shootingLine(career.all);
  return (
    <section className="section">
      <h2 className="font-display text-2xl mb-3" style={{ color: entity.color }}>{name}, season by season</h2>
      <div className="overflow-x-auto">
        <table className="w-full font-ui text-sm num">
          <thead>
            <tr className="border-b border-rule">
              <th className="label text-left py-2 pr-3">Season</th>
              {kind === 'player' && <th className="label text-left pr-3">Team</th>}
              <th className="label text-right pr-3">Shots</th>
              <th className="label text-right pr-3">FG%</th>
              <th className="label text-right pr-3">3PA</th>
              <th className="label text-right pr-3">3P%</th>
              <th className="label text-right pr-3" title="Share of shots that were threes">3s share</th>
              <th className="label text-right pr-3">League 3s</th>
              <th className="label text-right">eFG%</th>
            </tr>
          </thead>
          <tbody>
            {career.seasons.map(s => {
              const l = shootingLine(career.bySeason.get(s)!);
              return (
                <tr key={s} className="border-b border-rule-soft hover:bg-rule-soft/40">
                  <td className="py-1.5 pr-3">
                    <button className="font-semibold underline-offset-2 hover:underline" onClick={() => onOpenSeason(s)}>{s}</button>
                  </td>
                  {kind === 'player' && <td className="pr-3 text-ink-2">{career.teamsBySeason.get(s)?.join(', ')}</td>}
                  <td className="text-right pr-3">{l.shots.toLocaleString()}</td>
                  <td className="text-right pr-3">{pct(l.fgPct)}</td>
                  <td className="text-right pr-3">{l.threes.toLocaleString()}</td>
                  <td className="text-right pr-3">{pct(l.fg3Pct)}</td>
                  <td className="text-right pr-3 font-semibold" style={{ color: entity.color }}>{pct(l.threeShare, 0)}</td>
                  <td className="text-right pr-3 text-ink-3">{pct(index.league[s]?.threeShare, 0)}</td>
                  <td className="text-right">{pct(l.efgPct)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-3">Total</td>
              {kind === 'player' && <td />}
              <td className="text-right pr-3">{total.shots.toLocaleString()}</td>
              <td className="text-right pr-3">{pct(total.fgPct)}</td>
              <td className="text-right pr-3">{total.threes.toLocaleString()}</td>
              <td className="text-right pr-3">{pct(total.fg3Pct)}</td>
              <td className="text-right pr-3" style={{ color: entity.color }}>{pct(total.threeShare, 0)}</td>
              <td />
              <td className="text-right">{pct(total.efgPct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
