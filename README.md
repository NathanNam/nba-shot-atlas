# Shot Atlas

Where NBA players and teams shoot from, and how well, season by season since
2013-14. Each page opens with the finding in a headline, then the numbers
against the league, a hex-bin shot chart with a zone table, and a trend across
seasons. Career view: every season of a player or team, side by side with a
second one if you like.

The site is fully static: a Vite + React + TypeScript app plus JSON data files.
There is no server, database or login, so the host holds no secrets.

## Run it locally

```sh
npm ci
npm run dev        # http://localhost:8080
npm run build      # static site in dist/
npm run lint
```

## Data

`public/data/` is built by `scripts/build_data.py` and committed:

| File | What it holds |
|---|---|
| `seasons.json` | season list, default season, league averages per season and per court zone |
| `players.json` | every shooter: `[personId, name, [season start years]]` |
| `players/<personId>.json` | one player's shots over all seasons (columnar) |
| `teams/<tricode>.json` | one team's shots over all seasons |

Sources:

- Play-by-play: [shufinskiy/nba_data](https://github.com/shufinskiy/nba_data) (`nbastatsv3_YYYY.tar.xz`).
- Enrichment: `enrich_shots.py` from the [nba-shot-quality](https://github.com/bnamm1/nba-shot-quality)
  project; its `enriched_data/` holds 2013-14 to 2024-25.
- Player names: `nba_players_2013_2025.csv` from nba-shot-quality, with newer players taken from
  nba_data's `shotdetail_YYYY.tar.xz`.

### Adding a season

1. Download `nbastatsv3_YYYY.tar.xz` and `shotdetail_YYYY.tar.xz` from nba_data
   (YYYY = the season's start year) and unpack the CSVs.
2. Run nba-shot-quality's `enrich_shots.py` on it, from a copy of the script whose
   `raw_data/` holds `nbastatsv3_YYYY.csv`:
   `python enrich_shots.py --seasons YYYY --out-dir out`
3. Rebuild the data (later `--enriched` folders win for the same season):

   ```sh
   python3 scripts/build_data.py \
     --enriched ../nba-shot-quality/enriched_data path/to/out \
     --players ../nba-shot-quality/nba_players_2013_2025.csv \
     --shotdetail path/to/shotdetail_YYYY.csv
   ```

4. Commit `public/data/` and push. The newest season becomes the default.

## Deploy

`.github/workflows/pages.yml` lints, builds and publishes `dist/` to GitHub Pages on every
push to `main`. The custom domain is set in the repo's Pages settings, with DNS at Cloudflare.

## Code map

- `src/pages/Index.tsx`: the page, view state (kept in the URL so links can be shared)
- `src/components/app/`: `SeasonView`, `CareerView`, `Court` (hex-bin and dot chart),
  `TrendChart`, `EntityPicker`
- `src/lib/`: `shotStats.ts` (percentages, court zones), `headline.ts` (the headline
  sentence), `teams.ts`
- `src/services/staticData.ts`, `src/hooks/useData.ts`: loading the JSON files

## History

The app began as a Lovable project on Supabase with browser OpenTelemetry. Both were
removed in October 2026 when it became a static site; the Supabase backend
(`supabase/`) and the telemetry code (`src/otel-client.ts`) are in the git history
before that change if they are ever wanted again.
