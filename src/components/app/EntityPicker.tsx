import { useMemo, useState } from 'react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Kind, PlayerInfo } from '@/services/staticData';
import { TEAMS } from '@/lib/teams';

export interface Selection {
  id: string;
  name: string;
}

interface EntityPickerProps {
  kind: Kind;
  players: PlayerInfo[];
  /** Only list players with shots in this season (season view). */
  season?: string;
  selected: Selection[];
  onChange: (next: Selection[]) => void;
  max?: number;
}

const MAX_SHOWN = 80;

export function EntityPicker({ kind, players, season, selected, onChange, max = 2 }: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options: Selection[] = useMemo(() => {
    if (kind === 'team') return Object.entries(TEAMS).map(([id, name]) => ({ id, name }));
    const list = season ? players.filter(p => p.seasons.includes(season)) : players;
    // Two different players can share a name: add their last season to tell them apart.
    const count = new Map<string, number>();
    list.forEach(p => count.set(p.name, (count.get(p.name) ?? 0) + 1));
    return list.map(p => ({
      id: p.id,
      name: p.name,
      ...(count.get(p.name)! > 1 ? { hint: `${p.seasons[0]}–${p.seasons[p.seasons.length - 1].slice(5)}` } : {}),
    }));
  }, [kind, players, season]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = q
      ? options.filter(o => o.name.toLowerCase().includes(q) || o.id.toLowerCase() === q)
      : options;
    return hits.slice(0, MAX_SHOWN);
  }, [options, query]);

  const add = (o: Selection) => {
    if (selected.some(s => s.id === o.id)) return;
    // At the limit, a new pick replaces the second one.
    const next = selected.length >= max ? [...selected.slice(0, max - 1), o] : [...selected, o];
    onChange(next.map(({ id, name }) => ({ id, name })));
    setOpen(false);
    setQuery('');
  };

  const noun = kind === 'player' ? 'player' : 'team';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((s, i) => (
        <span key={s.id} className="control inline-flex items-center gap-2 py-1 pr-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: `rgb(var(--series-${i + 1}))` }} aria-hidden />
          <span className="font-medium">{kind === 'team' ? TEAMS[s.id] ?? s.name : s.name}</span>
          <button
            className="text-ink-3 hover:text-ink px-1"
            aria-label={`Remove ${s.name}`}
            onClick={() => onChange(selected.filter(x => x.id !== s.id))}
          >
            ×
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="control text-ink-2" aria-label={`Find a ${noun}`}>
            {selected.length === 0 ? `Find a ${noun}…` : selected.length < max ? `+ Compare with a ${noun}` : `Swap the second ${noun}`}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[300px] p-0 bg-panel border-rule-soft" style={{ borderRadius: 'var(--radius)' }}>
          <Command shouldFilter={false}>
            <CommandInput placeholder={`Search ${options.length.toLocaleString()} ${noun}s…`} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>No {noun} found{season ? ` in ${season}` : ''}.</CommandEmpty>
              {shown.map(o => (
                <CommandItem key={o.id} value={o.id} onSelect={() => add(o)} disabled={selected.some(s => s.id === o.id)}>
                  <span>{o.name}</span>
                  {'hint' in o && <span className="ml-auto text-xs text-ink-3">{(o as Selection & { hint: string }).hint}</span>}
                </CommandItem>
              ))}
              {!query && options.length > MAX_SHOWN && (
                <div className="px-3 py-2 text-xs text-ink-3">Type to search all {options.length.toLocaleString()}…</div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
