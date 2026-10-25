# The Shot Atlas

**[theshotatlas.com](https://theshotatlas.com)**

Where NBA players and teams shoot from, and how well, season by season from
2013-14 through 2025-26.

- **Season view:** a headline that states the finding (e.g. "Six in ten of Curry's
  shots in 2025-26 were threes. The league's rate was 42%."), the shooting numbers
  against the league average, a hex-bin shot chart, a zone table with league
  baselines, and a season-by-season trend.
- **Career view:** a trend chart (share of shots that were threes, 3P%, FG%, eFG%,
  points per shot, shots), a season table, one court per season, and every shot on
  one court.
- **Compare** two players or teams, or one player in two seasons.
- **Shareable links:** the URL keeps the view, e.g. `?mode=career&ids=201939,203081`.

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

- Play-by-play: [shufinskiy/nba_data](https://github.com/shufinskiy/nba_data) (`nbastatsv3_YYYY.tar.xz`),
  regular season only.
- Shot processing: `enrich_shots.py` from [bnamm1/nba-shot-quality](https://github.com/bnamm1/nba-shot-quality);
  its `enriched_data/` holds 2013-14 to 2024-25. The app uses each shot's location, result and
  value; the shot-clock and shot-context fields the script adds are not shown yet.
- Player names: `nba_players_2013_2025.csv` from nba-shot-quality, with newer players taken from
  nba_data's `shotdetail_YYYY.tar.xz`.
- Shot distances the source records as 0 ft (mostly corner threes) are recomputed from the
  coordinates.

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
push to `main` (it can also be run by hand from the Actions tab).

One-time setup:

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Pages → Custom domain:** `theshotatlas.com` (verify the domain first under
   your account's Pages settings, with the TXT record GitHub gives you).
3. **DNS at Cloudflare** (DNS only, grey cloud):
   - `A` records on `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` `www` → `nathannam.github.io`
4. **Enforce HTTPS** once GitHub has issued the certificate.

## Code map

- `src/pages/Index.tsx`: the page, view state (kept in the URL so links can be shared)
- `src/components/app/`: `SeasonView`, `CareerView`, `Court` (hex-bin and dot chart),
  `TrendChart`, `EntityPicker`
- `src/lib/`: `shotStats.ts` (percentages, court zones), `headline.ts` (the headline
  sentence), `teams.ts`
- `src/services/staticData.ts`, `src/hooks/useData.ts`: loading the JSON files
- `scripts/brand/make.mjs`: rebuilds the favicons and the share image (`public/og-image.png`,
  Curry's career shot map) from the data; see the comment at the top for how to run it

## Credits

- Play-by-play data: [shufinskiy/nba_data](https://github.com/shufinskiy/nba_data).
- Shot processing and player list: [bnamm1/nba-shot-quality](https://github.com/bnamm1/nba-shot-quality).
- Built with [Claude Code](https://claude.com/claude-code).

## History

The app began as a Lovable project on Supabase with browser OpenTelemetry. Both were
removed in October 2026 when it became a static site; the Supabase backend
(`supabase/`) and the telemetry code (`src/otel-client.ts`) are in the git history
before that change if they are ever wanted again.
