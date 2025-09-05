-- Manual test to populate league stats for 2024-25 season
-- This will call our edge function to compute stats

-- First, let's check if we have any existing stats
SELECT season FROM league_stats WHERE season = '2024-25';

-- Now let's manually insert a basic league stats entry to test
INSERT INTO league_stats (
  season,
  total_shots,
  made_shots,
  field_goal_percentage,
  two_point_made,
  two_point_attempted,
  two_point_percentage,
  three_point_made,
  three_point_attempted,
  three_point_percentage,
  zone_stats,
  hottest_zone,
  coldest_zone,
  favorite_spot
) VALUES (
  '2024-25',
  100000,
  46000,
  0.46,
  30000,
  65000,
  0.462,
  16000,
  35000,
  0.457,
  '[]'::jsonb,
  'Restricted Area (65.2%)',
  'Long 2 (39.8%)',
  'Paint (25,000 shots)'
) ON CONFLICT (season) DO UPDATE SET
  total_shots = EXCLUDED.total_shots,
  made_shots = EXCLUDED.made_shots,
  field_goal_percentage = EXCLUDED.field_goal_percentage,
  updated_at = now();