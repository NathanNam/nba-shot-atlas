import { useEffect, useState } from 'react';
import type { Kind } from '@/services/staticData';
import { usePlayers, useSeasonIndex } from '@/hooks/useData';
import { EntityPicker, type Selection } from '@/components/app/EntityPicker';
import { SeasonView, Empty } from '@/components/app/SeasonView';
import { CareerView } from '@/components/app/CareerView';
import { TEAMS } from '@/lib/teams';

type Mode = 'season' | 'career';

interface ViewState {
  mode: Mode;
  kind: Kind;
  players: Selection[];
  teams: Selection[];
  season: string | null;
  vs: string | null;
}

const DEFAULTS: ViewState = {
  mode: 'season',
  kind: 'player',
  players: [{ id: '201939', name: 'Stephen Curry' }],
  teams: [{ id: 'GSW', name: TEAMS.GSW }],
  season: null,
  vs: null,
};

// The view lives in the URL (?mode=career&kind=player&ids=201939,203081&season=2025-26&vs=2015-16),
// so a link opens the same page. Player names are filled in once players.json loads.
function readUrl(): ViewState {
  const q = new URLSearchParams(window.location.search);
  const kind: Kind = q.get('kind') === 'team' ? 'team' : 'player';
  const ids = (q.get('ids') ?? '').split(',').filter(Boolean).slice(0, 2);
  const sels = ids.map(id => ({ id, name: kind === 'team' ? TEAMS[id] ?? id : '' }));
  return {
    mode: q.get('mode') === 'career' ? 'career' : 'season',
    kind,
    players: kind === 'player' && sels.length ? sels : DEFAULTS.players,
    teams: kind === 'team' && sels.length ? sels : DEFAULTS.teams,
    season: q.get('season'),
    vs: q.get('vs'),
  };
}

function writeUrl(v: ViewState) {
  const q = new URLSearchParams();
  if (v.mode !== 'season') q.set('mode', v.mode);
  if (v.kind !== 'player') q.set('kind', v.kind);
  const sels = v.kind === 'player' ? v.players : v.teams;
  const def = v.kind === 'player' ? DEFAULTS.players : DEFAULTS.teams;
  if (sels.map(s => s.id).join() !== def.map(s => s.id).join()) q.set('ids', sels.map(s => s.id).join(','));
  if (v.mode === 'season' && v.season) q.set('season', v.season);
  if (v.mode === 'season' && v.vs) q.set('vs', v.vs);
  const s = q.toString();
  window.history.replaceState(null, '', s ? `?${s}` : window.location.pathname);
}

const Index = () => {
  const [view, setView] = useState<ViewState>(readUrl);
  const index = useSeasonIndex();
  const players = usePlayers();

  const season = view.season && index.data?.seasons.includes(view.season) ? view.season : index.data?.default ?? null;
  const selections = view.kind === 'player' ? view.players : view.teams;
  const update = (patch: Partial<ViewState>) => setView(v => ({ ...v, ...patch }));

  useEffect(() => writeUrl(view), [view]);

  // Players from a shared link arrive as ids only.
  useEffect(() => {
    if (!players.data || view.players.every(p => p.name)) return;
    const byId = new Map(players.data.map(p => [p.id, p.name]));
    update({ players: view.players.map(p => ({ ...p, name: p.name || byId.get(p.id) || p.id })).filter(p => byId.has(p.id)) });
  }, [players.data, view.players]);

  const setSelections = (next: Selection[]) => update(view.kind === 'player' ? { players: next } : { teams: next });
  const openSeason = (s: string) => {
    update({ mode: 'season', season: s, vs: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const seasons = index.data?.seasons ?? [];
  const canCompareSeasons = view.mode === 'season' && selections.length === 1;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
          <a href="./" className="font-display text-2xl leading-none whitespace-nowrap" aria-label="Shot Quality, home">
            Shot <i className="text-brand">Quality</i>
          </a>
          <nav className="seg" aria-label="View">
            <button aria-pressed={view.mode === 'season'} onClick={() => update({ mode: 'season' })}>Season</button>
            <button aria-pressed={view.mode === 'career'} onClick={() => update({ mode: 'career' })}>Career</button>
          </nav>
          <div className="seg" role="group" aria-label="Players or teams">
            <button aria-pressed={view.kind === 'player'} onClick={() => update({ kind: 'player' })}>Players</button>
            <button aria-pressed={view.kind === 'team'} onClick={() => update({ kind: 'team' })}>Teams</button>
          </div>
          {view.mode === 'season' && season && (
            <label className="ml-auto flex items-center gap-2 font-ui text-sm">
              <span className="text-ink-2">Season</span>
              <select className="control" value={season} onChange={e => update({ season: e.target.value, vs: view.vs === e.target.value ? null : view.vs })}>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
        </div>
      </header>

      <div className="border-b border-rule-soft">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <EntityPicker
            kind={view.kind}
            players={players.data ?? []}
            season={view.mode === 'season' ? season ?? undefined : undefined}
            selected={selections}
            onChange={setSelections}
          />
          {canCompareSeasons && season && (
            <label className="flex items-center gap-2 font-ui text-sm">
              <span className="text-ink-2">Compare with</span>
              <select className="control" value={view.vs ?? ''} onChange={e => update({ vs: e.target.value || null })}>
                <option value="">another season…</option>
                {seasons.filter(s => s !== season).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {index.error ? (
          <Empty tone="bad">{index.error}</Empty>
        ) : !index.data || !season ? (
          <Empty pulse>Loading…</Empty>
        ) : view.mode === 'career' ? (
          <CareerView kind={view.kind} selections={selections} index={index.data} onOpenSeason={openSeason} />
        ) : (
          <SeasonView
            kind={view.kind}
            selections={selections}
            season={season}
            compareSeason={canCompareSeasons ? view.vs : null}
            index={index.data}
            onOpenSeason={openSeason}
            onOpenCareer={() => update({ mode: 'career' })}
          />
        )}
      </main>

      <footer className="border-t border-rule">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 font-ui text-xs text-ink-2">
          <p>
            NBA regular seasons 2013-14 to 2025-26. Play-by-play from{' '}
            <a className="underline" href="https://github.com/shufinskiy/nba_data">shufinskiy/nba_data</a>, prepared with the
            nba-shot-quality project.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
