#!/usr/bin/env python3
"""Build the app's static data files from enriched shot CSVs.

Each season becomes one compact, columnar JSON file under public/data/, so the
app needs no database:

    public/data/seasons.json            season list (newest first) + default
    public/data/players.json            [[personId, full name, [season start years]], ...]
    public/data/shots/2025-26.json      one season of shots, columnar

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
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "data"
NAME = re.compile(r"nbastatsv3_(\d{4})_enriched_shots\.csv$")


def season_label(start: int) -> str:
    return f"{start}-{(start + 1) % 100:02d}"


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
        cols["d"].append(int(float(r["shotDistance"] or 0)))
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
    for start in sorted(files):
        label = season_label(start)
        data = read_season(files[start])
        data["season"] = label
        out = OUT / "shots" / f"{label}.json"
        out.write_text(json.dumps(data, separators=(",", ":")))
        for pid in data["playerIds"]:
            shooters.setdefault(pid, []).append(start)
        seasons.append(label)
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

    newest_first = sorted(seasons, reverse=True)
    default = args.default or newest_first[0]
    if default not in seasons:
        sys.exit(f"default season {default} not built")
    (OUT / "seasons.json").write_text(json.dumps({"seasons": newest_first, "default": default}))
    print(f"seasons: {newest_first[-1]} .. {newest_first[0]}, default {default}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
