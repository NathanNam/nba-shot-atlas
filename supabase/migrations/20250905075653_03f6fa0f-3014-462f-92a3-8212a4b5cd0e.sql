-- Create a policy to allow reading players data
CREATE POLICY "Allow public read access to players" 
ON public.players 
FOR SELECT 
USING (true);