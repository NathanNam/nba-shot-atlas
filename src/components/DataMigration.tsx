import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DataMigrator } from '@/scripts/migrateDataToSupabase';
import { useToast } from '@/hooks/use-toast';

export function DataMigration() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [shotProgress, setShotProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const { toast } = useToast();

  const handlePlayerMigration = async () => {
    try {
      setIsPlaying(true);
      setCurrentStatus('Migrating players...');
      setPlayerProgress(0);

      await DataMigrator.migratePlayersToSupabase();
      
      setPlayerProgress(100);
      setCurrentStatus('Players migration completed!');
      
      toast({
        title: "Success",
        description: "Players have been successfully migrated to Supabase!",
      });
    } catch (error) {
      console.error('Player migration error:', error);
      toast({
        title: "Error",
        description: `Player migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsPlaying(false);
    }
  };

  const handleShotDataMigration = async () => {
    try {
      setIsPlaying(true);
      setCurrentStatus('Migrating shot data...');
      setShotProgress(0);

      const seasons = ['2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
      
      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        setCurrentStatus(`Migrating season ${season}...`);
        setShotProgress((i / seasons.length) * 100);
        
        await DataMigrator.migrateShotDataToSupabase([season]);
      }
      
      setShotProgress(100);
      setCurrentStatus('Shot data migration completed!');
      
      toast({
        title: "Success",
        description: "Shot data has been successfully migrated to Supabase!",
      });
    } catch (error) {
      console.error('Shot data migration error:', error);
      toast({
        title: "Error",
        description: `Shot data migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsPlaying(false);
    }
  };

  const handleFullMigration = async () => {
    try {
      setIsPlaying(true);
      setCurrentStatus('Starting full migration...');
      
      // Players first
      setCurrentStatus('Migrating players...');
      setPlayerProgress(0);
      await DataMigrator.migratePlayersToSupabase();
      setPlayerProgress(100);
      
      // Then shot data
      setCurrentStatus('Migrating shot data...');
      setShotProgress(0);
      
      const seasons = ['2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
      
      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i];
        setCurrentStatus(`Migrating season ${season}...`);
        setShotProgress((i / seasons.length) * 100);
        
        await DataMigrator.migrateShotDataToSupabase([season]);
      }
      
      setShotProgress(100);
      setCurrentStatus('Full migration completed!');
      
      toast({
        title: "Success",
        description: "All data has been successfully migrated to Supabase!",
      });
    } catch (error) {
      console.error('Full migration error:', error);
      toast({
        title: "Error",
        description: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Data Migration to Supabase</CardTitle>
        <CardDescription>
          Migrate your CSV data to Supabase for better performance and reliability.
          This will improve loading times, especially on mobile devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Players Migration</span>
              <span className="text-sm text-muted-foreground">{playerProgress}%</span>
            </div>
            <Progress value={playerProgress} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Shot Data Migration</span>
              <span className="text-sm text-muted-foreground">{shotProgress}%</span>
            </div>
            <Progress value={shotProgress} className="h-2" />
          </div>
        </div>

        {currentStatus && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{currentStatus}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button 
            onClick={handlePlayerMigration} 
            disabled={isPlaying}
            variant="outline"
          >
            {isPlaying ? 'Migrating...' : 'Migrate Players Only'}
          </Button>
          
          <Button 
            onClick={handleShotDataMigration} 
            disabled={isPlaying}
            variant="outline"
          >
            {isPlaying ? 'Migrating...' : 'Migrate Shot Data Only'}
          </Button>
          
          <Button 
            onClick={handleFullMigration} 
            disabled={isPlaying}
            className="bg-primary text-primary-foreground"
          >
            {isPlaying ? 'Migrating...' : 'Migrate All Data'}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>⚠️ This process may take several minutes depending on your internet connection.</p>
          <p>📊 The migration will skip data that already exists in Supabase.</p>
          <p>🔄 You can safely run this multiple times.</p>
        </div>
      </CardContent>
    </Card>
  );
}