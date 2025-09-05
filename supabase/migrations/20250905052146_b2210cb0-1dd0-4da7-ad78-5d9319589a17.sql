-- Add INSERT policies for data migration
CREATE POLICY "Allow public inserts on players" 
ON public.players 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public inserts on shots" 
ON public.shots 
FOR INSERT 
WITH CHECK (true);