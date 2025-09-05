-- Create tables for NBA shot analytics data

-- Table for storing player information
CREATE TABLE public.players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for storing shot data
CREATE TABLE public.shots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season TEXT NOT NULL,
  person_id TEXT NOT NULL,
  team_tricode TEXT NOT NULL,
  x_legacy DECIMAL NOT NULL,
  y_legacy DECIMAL NOT NULL,
  shot_result TEXT NOT NULL,
  shot_distance DECIMAL NOT NULL,
  description TEXT,
  sub_type TEXT,
  shot_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Foreign key to players table
  FOREIGN KEY (person_id) REFERENCES public.players(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_shots_season ON public.shots(season);
CREATE INDEX idx_shots_person_id ON public.shots(person_id);
CREATE INDEX idx_shots_team_tricode ON public.shots(team_tricode);
CREATE INDEX idx_shots_season_person ON public.shots(season, person_id);
CREATE INDEX idx_shots_season_team ON public.shots(season, team_tricode);
CREATE INDEX idx_shots_shot_result ON public.shots(shot_result);

-- Create index on players for better join performance
CREATE INDEX idx_players_team ON public.players(team);

-- Enable Row Level Security (RLS) for public read access
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to data
CREATE POLICY "Players are publicly readable" 
ON public.players 
FOR SELECT 
USING (true);

CREATE POLICY "Shots are publicly readable" 
ON public.shots 
FOR SELECT 
USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for players table
CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();