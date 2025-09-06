-- Add indexes for teamTricode on all season tables to improve query performance
-- This will eliminate timeout issues when filtering by team

-- Index for shots_2013-14
CREATE INDEX IF NOT EXISTS idx_shots_2013_14_teamTricode ON "shots_2013-14" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2013_14_team_composite ON "shots_2013-14" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2014-15
CREATE INDEX IF NOT EXISTS idx_shots_2014_15_teamTricode ON "shots_2014-15" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2014_15_team_composite ON "shots_2014-15" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2015-16
CREATE INDEX IF NOT EXISTS idx_shots_2015_16_teamTricode ON "shots_2015-16" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2015_16_team_composite ON "shots_2015-16" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2016-17
CREATE INDEX IF NOT EXISTS idx_shots_2016_17_teamTricode ON "shots_2016-17" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2016_17_team_composite ON "shots_2016-17" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2017-18
CREATE INDEX IF NOT EXISTS idx_shots_2017_18_teamTricode ON "shots_2017-18" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2017_18_team_composite ON "shots_2017-18" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2018-19
CREATE INDEX IF NOT EXISTS idx_shots_2018_19_teamTricode ON "shots_2018-19" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2018_19_team_composite ON "shots_2018-19" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2019-20
CREATE INDEX IF NOT EXISTS idx_shots_2019_20_teamTricode ON "shots_2019-20" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2019_20_team_composite ON "shots_2019-20" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2020-21
CREATE INDEX IF NOT EXISTS idx_shots_2020_21_teamTricode ON "shots_2020-21" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2020_21_team_composite ON "shots_2020-21" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2021-22
CREATE INDEX IF NOT EXISTS idx_shots_2021_22_teamTricode ON "shots_2021-22" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2021_22_team_composite ON "shots_2021-22" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2022-23
CREATE INDEX IF NOT EXISTS idx_shots_2022_23_teamTricode ON "shots_2022-23" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2022_23_team_composite ON "shots_2022-23" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2023-24
CREATE INDEX IF NOT EXISTS idx_shots_2023_24_teamTricode ON "shots_2023-24" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2023_24_team_composite ON "shots_2023-24" ("teamTricode", "gameId", "actionNumber");

-- Index for shots_2024-25
CREATE INDEX IF NOT EXISTS idx_shots_2024_25_teamTricode ON "shots_2024-25" ("teamTricode");
CREATE INDEX IF NOT EXISTS idx_shots_2024_25_team_composite ON "shots_2024-25" ("teamTricode", "gameId", "actionNumber");