import { useState, useEffect } from 'react';

export interface ShotData {
  personId: string;
  teamTricode: string;
  xLegacy: number;
  yLegacy: number;
  shotResult: string;
  shotDistance: number;
  description: string;
  subType: string;
  shotValue: number;
}

export function useShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadShotData = async () => {
      if (!entityId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Map season format (e.g., "2024-25" to "2024")
        const year = season.includes('-') ? season.split('-')[0] : season;
        const csvPath = `/data/nbastatsv3_${year}_enriched_shots.csv`;
        
        const response = await fetch(csvPath);
        if (!response.ok) {
          throw new Error(`Failed to load data for ${season}`);
        }
        
        const csvText = await response.text();
        const shots = parseCsv(csvText);
        
        // Filter shots based on view mode and entity
        let filteredShots = shots;
        
        if (viewMode === 'player') {
          filteredShots = shots.filter(shot => 
            shot.personId === entityId
          );
        } else if (viewMode === 'team') {
          filteredShots = shots.filter(shot => 
            shot.teamTricode === entityId
          );
        }
        // For league mode, use all shots
        
        setShotData(filteredShots);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shot data');
        setShotData([]);
      } finally {
        setLoading(false);
      }
    };

    loadShotData();
  }, [season, entityId, viewMode]);

  return { shotData, loading, error };
}

function parseCsv(csvText: string): ShotData[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  const shots: ShotData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) continue;
    
    const shot: any = {};
    headers.forEach((header, index) => {
      shot[header] = values[index];
    });
    
    // Convert numeric fields
    shot.personId = shot.personId ? shot.personId.toString() : '';
    shot.xLegacy = parseFloat(shot.xLegacy) || 0;
    shot.yLegacy = parseFloat(shot.yLegacy) || 0;
    shot.shotDistance = parseFloat(shot.shotDistance) || 0;
    shot.shotValue = parseInt(shot.shotValue) || 0;
    
    shots.push(shot as ShotData);
  }
  
  return shots;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}