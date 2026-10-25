import { useEffect, useState } from 'react';
import {
  loadCareer, loadPlayers, loadSeasonIndex,
  type Career, type Kind, type PlayerInfo, type SeasonIndex,
} from '@/services/staticData';

export interface Loadable<T> {
  data?: T;
  error?: string;
}

/** Run a loader for the given key; a result that arrives after the key changed is dropped. */
function useLoad<T>(key: string | null, load: () => Promise<T>): Loadable<T> & { loading: boolean } {
  const [state, setState] = useState<{ key: string | null } & Loadable<T>>({ key: null });
  useEffect(() => {
    if (key == null) return;
    let ignore = false;
    load().then(
      data => !ignore && setState({ key, data }),
      err => !ignore && setState({ key, error: err instanceof Error ? err.message : String(err) })
    );
    return () => {
      ignore = true;
    };
    // `load` is derived from `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key ? state : { key };
  return { data: current.data, error: current.error, loading: key != null && !current.data && !current.error };
}

export function useSeasonIndex() {
  return useLoad<SeasonIndex>('seasons', loadSeasonIndex);
}

export function usePlayers() {
  return useLoad<PlayerInfo[]>('players', loadPlayers);
}

export function useCareer(kind: Kind, id: string | null) {
  return useLoad<Career>(id ? `${kind}/${id}` : null, () => loadCareer(kind, id!));
}
