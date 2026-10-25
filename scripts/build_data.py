#!/usr/bin/env python3
"""Build the app's static data files from enriched shot CSVs.

Each season becomes one compact, columnar JSON file under public/data/, so the
app needs no database:

    public/data/seasons.json            season list (newest first) + default
    public/data/players.json            [[personId, full name, [season start years]], ...]
    public/data/shots/2025-26.json      one season of shots, columnar
    public/data/players/<personId>.json one player's shots over all seasons (career view)
    public/data/teams/<tricode>.json    one team's shots over all seasons

seasons.json also carries league-wide shooting per season (FG%, 3P%, eFG%,
points per shot, share of shots that were threes) for the career charts.

Inputs are the enriched CSVs written by nba-shot-quality's enrich_shots.py
(nbastatsv3_YYYY_enriched_shots.csv, YYYY = season start year). Several
--enriched dirs can be given; a later dir wins for a season found in both.

Full player names come from nba-shot-quality's nba_players_2013_2025.csv; players
missing from it are filled from shotdetail_YYYY.csv files (shufinskiy/nba_data).

Usage:
    python3 scripts/build_data.py \
        --enriched ../nba-shot-quality/enriched_data ../hoops-enrich/out \
        --players ../nba-shot-quality/nba_players_2013_2025.csv \
        --shotdetail ../hoops-enrich/shotdetail/shotdetail_2025.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "data"
NAME = re.compile(r"nbastatsv3_(\d{4})_enriched_shots\.csv$")


def season_label(start: int) -> str:
    return f"{start}-{(start + 1) % 100:02d}"


def shot_distance(r: dict) -> int:
    """Distance in feet. The source records some shots (mostly corner threes) as
    0 ft; when the coordinates (tenths of a foot from the hoop) put a shot past
    the restricted area, use the distance from the coordinates instead."""
    d = int(float(r["shotDistance"] or 0))
    x, y = float(r["xLegacy"] or 0), float(r["yLegacy"] or 0)
    from_xy = math.hypot(x, y) / 10
    return round(from_xy) if d == 0 and from_xy > 4 else d


def read_season(path: Path) -> dict:
    rows = []
    with path.open(newline="") as f:
        for r in csv.DictReader(f):
            rows.append((int(r["gameId"]), int(r["actionNumber"]), r))
    rows.sort(key=lambda t: (t[0], t[1]))

    teams, subtypes, players = {}, {}, {}

    def idx(table: dict, key: str) -> int:
        return table.setdefault(key, len(table))

    cols = {k: [] for k in ("p", "t", "x", "y", "d", "m", "v", "s")}
    for _, _, r in rows:
        cols["p"].append(idx(players, r["personId"]))
        cols["t"].append(idx(teams, r["teamTricode"]))
        cols["x"].append(int(float(r["xLegacy"] or 0)))
        cols["y"].append(int(float(r["yLegacy"] or 0)))
        cols["d"].append(shot_distance(r))
        cols["m"].append(1 if r["shotResult"] == "Made" else 0)
        cols["v"].append(int(float(r["shotValue"] or 2)))
        cols["s"].append(idx(subtypes, r["subType"]))

    return {
        "count": len(rows),
        "teams": list(teams),
        "subTypes": list(subtypes),
        "playerIds": [int(p) for p in players],
        **cols,
    }


def league_summary(data: dict) -> dict:
    n = data["count"]
    made = sum(data["m"])
    threes = [i for i, v in enumerate(data["v"]) if v == 3]
    made3 = sum(data["m"][i] for i in threes)
    points = sum(m * v for m, v in zip(data["m"], data["v"]))
    return {
        "shots": n,
        "fgPct": round(made / n, 4),
        "fg3Pct": round(made3 / len(threes), 4),
        "threeShare": round(len(threes) / n, 4),
        "efgPct": round((made + 0.5 * made3) / n, 4),
        "pointsPerShot": round(points / n, 4),
    }


CAREER_COLS = ("x", "y", "d", "m", "v")


def write_careers(by_season: dict[str, dict], kind: str) -> int:
    """One file per player (kind 'p') or team (kind 't') with every season's shots.

    Columns as in the season files, plus n (index into "seasons"). Player files
    also keep t (team per shot), since players change teams."""
    out_dir = OUT / ("players" if kind == "p" else "teams")
    out_dir.mkdir(parents=True, exist_ok=True)
    careers: dict[str, dict] = {}
    for label, data in by_season.items():
        keys = data["playerIds"] if kind == "p" else data["teams"]
        for i, k in enumerate(data[kind]):
            key = str(keys[k])
            c = careers.get(key)
            if c is None:
                c = careers[key] = {"seasons": [], "teams": {}, "subTypes": {},
                                    "n": [], "t": [], "s": [], **{col: [] for col in CAREER_COLS}}
            if not c["seasons"] or c["seasons"][-1] != label:
                c["seasons"].append(label)
            c["n"].append(len(c["seasons"]) - 1)
            if kind == "p":
                c["t"].append(c["teams"].setdefault(data["teams"][data["t"][i]], len(c["teams"])))
            c["s"].append(c["subTypes"].setdefault(data["subTypes"][data["s"][i]], len(c["subTypes"])))
            for col in CAREER_COLS:
                c[col].append(data[col][i])
    for key, c in careers.items():
        c["id"] = key
        c["count"] = len(c["n"])
        c["teams"] = list(c["teams"])
        c["subTypes"] = list(c["subTypes"])
        if kind == "t":
            del c["t"], c["teams"]
        (out_dir / f"{key}.json").write_text(json.dumps(c, separators=(",", ":")))
    return len(careers)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--enriched", type=Path, nargs="+", required=True)
    ap.add_argument("--players", type=Path, required=True)
    ap.add_argument("--shotdetail", type=Path, nargs="*", default=[])
    ap.add_argument("--default", help="default season, e.g. 2025-26 (newest if omitted)")
    args = ap.parse_args(argv)

    files: dict[int, Path] = {}
    for d in args.enriched:
        for p in sorted(d.glob("nbastatsv3_*_enriched_shots.csv")):
            m = NAME.search(p.name)
            if m:
                files[int(m.group(1))] = p
    if not files:
        sys.exit("no enriched CSVs found")

    names: dict[int, str] = {}
    with args.players.open(newline="") as f:
        for r in csv.DictReader(f):
            names[int(r["personId"])] = r["playerFullName"]
    extra: dict[int, str] = {}
    for p in args.shotdetail:
        with p.open(newline="") as f:
            for r in csv.DictReader(f):
                extra.setdefault(int(r["PLAYER_ID"]), r["PLAYER_NAME"])

    (OUT / "shots").mkdir(parents=True, exist_ok=True)
    shooters: dict[int, list[int]] = {}
    seasons = []
    by_season: dict[str, dict] = {}
    league: dict[str, dict] = {}
    for start in sorted(files):
        label = season_label(start)
        data = read_season(files[start])
        data["season"] = label
        out = OUT / "shots" / f"{label}.json"
        out.write_text(json.dumps(data, separators=(",", ":")))
        for pid in data["playerIds"]:
            shooters.setdefault(pid, []).append(start)
        seasons.append(label)
        by_season[label] = data
        league[label] = league_summary(data)
        print(f"{label}: {data['count']:,} shots, {len(data['playerIds'])} players, "
              f"{len(data['teams'])} teams -> {out.relative_to(REPO)} "
              f"({out.stat().st_size / 1e6:.1f} MB)  [{files[start]}]")

    players, missing = [], []
    for pid in sorted(shooters):
        name = names.get(pid) or extra.get(pid)
        if name:
            players.append([pid, name, shooters[pid]])
        else:
            missing.append(pid)
    players.sort(key=lambda t: t[1])
    (OUT / "players.json").write_text(json.dumps(players, ensure_ascii=False, separators=(",", ":")))
    filled = sum(1 for pid in shooters if pid not in names and pid in extra)
    print(f"players: {len(players)} ({filled} named from shot detail, {len(missing)} without a name)")
    if missing:
        print("  no name for personId:", " ".join(map(str, missing)))

    print(f"careers: {write_careers(by_season, 'p')} player files, "
          f"{write_careers(by_season, 't')} team files")

    newest_first = sorted(seasons, reverse=True)
    default = args.default or newest_first[0]
    if default not in seasons:
        sys.exit(f"default season {default} not built")
    (OUT / "seasons.json").write_text(json.dumps(
        {"seasons": newest_first, "default": default, "league": league}, indent=1))
    print(f"seasons: {newest_first[-1]} .. {newest_first[0]}, default {default}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
