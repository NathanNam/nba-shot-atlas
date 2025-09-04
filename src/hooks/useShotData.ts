import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';

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

// Global cache for shot data to persist across component unmounts
const dataCache = new Map<string, {
  rawData: ShotData[];
  filteredData: Map<string, ShotData[]>;
  timestamp: number;
}>();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

export function useShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadShotData = async () => {
      if (!entityId && viewMode !== 'league') {
        setShotData([]);
        return;
      }
      
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      const year = season.includes('-') ? season.split('-')[0] : season;
      const cacheKey = `${season}-${year}`;
      const filterKey = `${viewMode}-${entityId}`;
      
      // Check if we have cached data for this season
      const cached = dataCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // Check if we have this specific filter cached
        const cachedFiltered = cached.filteredData.get(filterKey);
        if (cachedFiltered) {
          setShotData(cachedFiltered);
          setLoading(false);
          return;
        }
        
        // We have raw data but not this filter, compute filter
        const filteredShots = applyFilter(cached.rawData, viewMode, entityId);
        cached.filteredData.set(filterKey, filteredShots);
        setShotData(filteredShots);
        setLoading(false);
        return;
      }
      
      // Need to load fresh data
      setLoading(true);
      setError(null);
      
      try {
        let csvText = '';
        
        // Try loading compressed file first
        const zipPath = `/data/nbastatsv3_${year}_enriched_shots.csv.zip`;
        try {
          const zipResponse = await fetch(zipPath, { signal });
          if (zipResponse.ok) {
            const zipBlob = await zipResponse.blob();
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(zipBlob);
            const csvFileName = `nbastatsv3_${year}_enriched_shots.csv`;
            const csvFile = zipContent.file(csvFileName);
            if (csvFile) {
              csvText = await csvFile.async('string');
            } else {
              throw new Error(`CSV file ${csvFileName} not found in zip`);
            }
          } else {
            throw new Error('Zip file not found');
          }
        } catch (zipError) {
          // Fallback to uncompressed CSV
          const csvPath = `/data/nbastatsv3_${year}_enriched_shots.csv`;
          const response = await fetch(csvPath, { signal });
          if (!response.ok) {
            throw new Error(`Failed to load data for ${season} (tried both .zip and .csv)`);
          }
          csvText = await response.text();
        }
        
        if (signal.aborted) return;
        
        const shots = parseCsv(csvText);
        if (signal.aborted) return;
        
        // Cache the raw data
        const newCache = {
          rawData: shots,
          filteredData: new Map<string, ShotData[]>(),
          timestamp: now
        };
        
        // Apply current filter and cache it
        const filteredShots = applyFilter(shots, viewMode, entityId);
        newCache.filteredData.set(filterKey, filteredShots);
        
        dataCache.set(cacheKey, newCache);
        setShotData(filteredShots);
        
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load shot data');
        setShotData([]);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadShotData();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [season, entityId, viewMode]);

  return { shotData, loading, error };
}

function applyFilter(shots: ShotData[], viewMode: 'player' | 'team' | 'league', entityId: string): ShotData[] {
  if (viewMode === 'player') {
    return shots.filter(shot => shot.personId === entityId);
  } else if (viewMode === 'team') {
    return shots.filter(shot => shot.teamTricode === entityId);
  }
  // For league mode, use all shots
  return shots;
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