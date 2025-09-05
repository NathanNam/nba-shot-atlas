-- Create league statistics table for pre-computed stats
CREATE TABLE public.league_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season TEXT NOT NULL UNIQUE,
  total_shots BIGINT NOT NULL DEFAULT 0,
  made_shots BIGINT NOT NULL DEFAULT 0,
  field_goal_percentage DECIMAL(5,4) NOT NULL DEFAULT 0,
  two_point_made BIGINT NOT NULL DEFAULT 0,
  two_point_attempted BIGINT NOT NULL DEFAULT 0,
  two_point_percentage DECIMAL(5,4) NOT NULL DEFAULT 0,
  three_point_made BIGINT NOT NULL DEFAULT 0,
  three_point_attempted BIGINT NOT NULL DEFAULT 0,
  three_point_percentage DECIMAL(5,4) NOT NULL DEFAULT 0,
  zone_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  hottest_zone TEXT,
  coldest_zone TEXT,
  favorite_spot TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.league_stats ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to league_stats" 
ON public.league_stats 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_league_stats_updated_at
BEFORE UPDATE ON public.league_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_league_stats_season ON public.league_stats(season);