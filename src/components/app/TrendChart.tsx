import { useEffect, useRef, useState } from 'react';

export interface Series {
  name: string;
  /** CSS colour, e.g. 'rgb(var(--series-1))' */
  color: string;
  values: (number | null)[];
  /** Shots behind each value, shown on hover. */
  counts?: number[];
  dashed?: boolean;
}

interface TrendChartProps {
  seasons: string[];
  series: Series[];
  format: (v: number) => string;
  /** Axis ticks format (defaults to format). */
  tickFormat?: (v: number) => string;
  onSelect?: (season: string) => void;
  height?: number;
  /** Start the y axis at zero (volumes). */
  zero?: boolean;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

export function TrendChart({ seasons, series, format, tickFormat = format, onSelect, height = 260, zero }: TrendChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const all = series.flatMap(s => s.values).filter((v): v is number => v != null);
  if (!all.length) return <div ref={ref} style={{ height }} />;
  let lo = zero ? 0 : Math.min(...all);
  let hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || hi * 0.1 || 1;
  lo = zero ? 0 : lo - pad;
  hi = hi + pad;
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);

  const compact = width < 520;
  // Room on the right for the end labels ("Stephen Curry 61%"), about 7 px per character.
  const endChars = Math.max(...series.map(sr => Math.min(sr.name.length, 16) + 7));
  const m = { top: 14, right: compact ? 24 : Math.min(190, 18 + endChars * 7), bottom: 28, left: 46 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const x = (i: number) => m.left + (seasons.length === 1 ? iw / 2 : (i * iw) / (seasons.length - 1));
  const y = (v: number) => m.top + ih - ((v - lo) / (hi - lo)) * ih;
  const step = seasons.length > 1 ? iw / (seasons.length - 1) : iw;
  const labelEvery = Math.ceil(seasons.length / Math.max(2, Math.floor(iw / 70)));

  // Lines break at missing seasons.
  const pathOf = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // End labels: last non-null value of each series, nudged apart vertically.
  const ends = series
    .map(s => {
      const i = s.values.map((v, k) => (v == null ? -1 : k)).filter(k => k >= 0).pop();
      return i == null ? null : { s, i, v: s.values[i]!, yy: y(s.values[i]!) };
    })
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < ends.length; k++) if (ends[k].yy - ends[k - 1].yy < 16) ends[k].yy = ends[k - 1].yy + 16;

  const tipLeft = hover == null ? 0 : Math.min(Math.max(x(hover) - 90, 0), width - 190);

  return (
    <div ref={ref} className="relative font-ui select-none">
      <svg width={width} height={height} role="img" aria-label="Trend by season" onMouseLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} style={{ stroke: 'rgb(var(--rule-soft))' }} />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} style={{ fill: 'rgb(var(--ink-3))' }} className="num">
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {seasons.map((s, i) =>
          i % labelEvery === 0 || i === seasons.length - 1 ? (
            <text key={s} x={x(i)} y={height - 8} textAnchor={i === seasons.length - 1 && compact ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={11} style={{ fill: 'rgb(var(--ink-3))' }} className="num">
              {s}
            </text>
          ) : null
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} style={{ stroke: 'rgb(var(--ink-3))' }} strokeDasharray="2 3" />}
        {series.map(s => (
          <g key={s.name}>
            <path d={pathOf(s.values)} fill="none" style={{ stroke: s.color }} strokeWidth={s.dashed ? 2 : 3} strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" />
            {!s.dashed &&
              s.values.map((v, i) =>
                v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} style={{ fill: s.color }} />
              )}
          </g>
        ))}
        {!compact &&
          ends.map(e => (
            <text key={e.s.name} x={x(e.i) + 10} y={e.yy + 4} fontSize={12} fontWeight={e.s.dashed ? 400 : 700} style={{ fill: e.s.color }}>
              {e.s.name.length > 16 ? `${e.s.name.slice(0, 15)}…` : e.s.name} {format(e.v)}
            </text>
          ))}
        {seasons.map((s, i) => (
          <rect
            key={s}
            x={x(i) - step / 2}
            y={m.top}
            width={step}
            height={ih}
            fill="transparent"
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onMouseEnter={() => setHover(i)}
            onClick={() => onSelect?.(s)}
          />
        ))}
      </svg>
      {compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
          {series.map(s => (
            <span key={s.name} className="flex items-center gap-1.5" style={{ color: s.color }}>
              <span className="inline-block w-4 border-t-2" style={{ borderColor: s.color, borderStyle: s.dashed ? 'dashed' : 'solid' }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[180px] border border-rule-soft bg-panel px-3 py-2 text-xs shadow-sm"
          style={{ left: tipLeft, borderRadius: 'var(--radius)' }}
        >
          <div className="font-semibold text-ink mb-1">{seasons[hover]}</div>
          {series.map(s => (
            <div key={s.name} className="flex justify-between gap-2 num">
              <span className="truncate" style={{ color: s.color }}>{s.name}</span>
              <span className="text-ink">
                {s.values[hover] == null ? '–' : format(s.values[hover]!)}
                {s.counts?.[hover] ? <span className="text-ink-3"> · {s.counts[hover].toLocaleString()}</span> : null}
              </span>
            </div>
          ))}
          {onSelect && <div className="text-ink-3 mt-1">Click to open this season</div>}
        </div>
      )}
    </div>
  );
}
