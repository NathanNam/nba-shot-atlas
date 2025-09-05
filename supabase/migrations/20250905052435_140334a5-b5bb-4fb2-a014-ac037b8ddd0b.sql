-- Remove the team column from the players table since it's not being used
ALTER TABLE public.players DROP COLUMN team;

-- Remove the index on team column since we're dropping the column
DROP INDEX IF EXISTS idx_players_team;