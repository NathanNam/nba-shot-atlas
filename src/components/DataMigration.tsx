import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataMigrator } from '@/scripts/migrateDataToSupabase';
import { useToast } from '@/hooks/use-toast';

export function DataMigration() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [shotProgress, setShotProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'existing' | 'upload'>('existing');
  const playerFileRef = useRef<HTMLInputElement>(null);
  const shotFilesRef = useRef<HTMLInputElement>(null);
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

  const handleFileUpload = async (type: 'players' | 'shots') => {
    const fileInput = type === 'players' ? playerFileRef.current : shotFilesRef.current;
    const files = fileInput?.files;
    
    if (!files || files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPlaying(true);
      
      if (type === 'players') {
        setCurrentStatus('Processing player file...');
        setPlayerProgress(0);
        
        const file = files[0];
        const text = await file.text();
        
        // Parse CSV and upload to Supabase
        await DataMigrator.migratePlayersFromText(text);
        
        setPlayerProgress(100);
        setCurrentStatus('Players upload completed!');
        
        toast({
          title: "Success",
          description: "Player data has been uploaded successfully!",
        });
      } else {
        setCurrentStatus('Processing shot data files...');
        setShotProgress(0);
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const text = await file.text();
          const fileName = file.name;
          
          // Extract season from filename
          const seasonMatch = fileName.match(/(\d{4})/);
          const season = seasonMatch ? seasonMatch[1] : `custom_${i}`;
          
          setCurrentStatus(`Processing ${fileName}...`);
          setShotProgress((i / files.length) * 100);
          
          await DataMigrator.migrateShotDataFromText(text, season);
        }
        
        setShotProgress(100);
        setCurrentStatus('Shot data upload completed!');
        
        toast({
          title: "Success",
          description: "Shot data has been uploaded successfully!",
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Error",
        description: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        {/* Upload Mode Selector */}
        <div className="flex space-x-4 p-3 bg-muted rounded-lg">
          <button
            onClick={() => setUploadMode('existing')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              uploadMode === 'existing'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-accent'
            }`}
          >
            Use Existing Files
          </button>
          <button
            onClick={() => setUploadMode('upload')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              uploadMode === 'upload'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-accent'
            }`}
          >
            Upload CSV Files
          </button>
        </div>

        {/* File Upload Section */}
        {uploadMode === 'upload' && (
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="text-sm font-semibold">Upload CSV Files</h3>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="player-file" className="text-sm font-medium">
                  Player Data (CSV)
                </Label>
                <Input
                  id="player-file"
                  ref={playerFileRef}
                  type="file"
                  accept=".csv"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Expected format: id, name, team
                </p>
              </div>
              
              <div>
                <Label htmlFor="shot-files" className="text-sm font-medium">
                  Shot Data (CSV files)
                </Label>
                <Input
                  id="shot-files"
                  ref={shotFilesRef}
                  type="file"
                  accept=".csv"
                  multiple
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Select multiple CSV files for different seasons
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => handleFileUpload('players')}
                disabled={isPlaying}
                variant="outline"
                size="sm"
              >
                Upload Players
              </Button>
              <Button
                onClick={() => handleFileUpload('shots')}
                disabled={isPlaying}
                variant="outline"
                size="sm"
              >
                Upload Shot Data
              </Button>
            </div>
          </div>
        )}

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
          {uploadMode === 'existing' && (
            <>
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
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {uploadMode === 'existing' ? (
            <>
              <p>⚠️ This process may take several minutes depending on your internet connection.</p>
              <p>📊 The migration will skip data that already exists in Supabase.</p>
              <p>🔄 You can safely run this multiple times.</p>
            </>
          ) : (
            <>
              <p>📁 Upload your own CSV files to migrate custom data.</p>
              <p>📊 Files will be processed and uploaded to Supabase.</p>
              <p>⚠️ Make sure your CSV files have the correct format.</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}