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
// Use window global to share with preloader
declare global {
  interface Window {
    __NBA_DATA_CACHE__?: Map<string, {
      rawData: ShotData[];
      filteredData: Map<string, ShotData[]>;
      timestamp: number;
    }>;
  }
}

// Initialize global cache if it doesn't exist
if (typeof window !== 'undefined' && !window.__NBA_DATA_CACHE__) {
  window.__NBA_DATA_CACHE__ = new Map();
}

const dataCache = typeof window !== 'undefined' ? window.__NBA_DATA_CACHE__! : new Map();

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
          console.log(`✅ Cache hit: ${viewMode} ${entityId} for ${season} (${cachedFiltered.length} shots)`);
          setShotData(cachedFiltered);
          setLoading(false);
          return;
        }
        
        // We have raw data but not this filter, compute filter
        const filteredShots = applyFilter(cached.rawData, viewMode, entityId);
        cached.filteredData.set(filterKey, filteredShots);
        console.log(`✅ Cache + filter: ${viewMode} ${entityId} for ${season} (${filteredShots.length} shots)`);
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
  // Log filtered data for debugging
  console.log(`🔍 Filtering ${shots.length} shots: ${viewMode} = "${entityId}"`);
  
  let filtered: ShotData[];
  if (viewMode === 'league') {
    filtered = shots;
  } else if (viewMode === 'player') {
    filtered = shots.filter(shot => shot.personId === entityId);
    console.log(`👤 Player filter: found ${filtered.length} shots for ID ${entityId}`);
    if (filtered.length === 0) {
      // Debug: show sample of available player IDs
      const sampleIds = [...new Set(shots.slice(0, 100).map(s => s.personId))].slice(0, 10);
      console.log('🔍 Sample player IDs in data:', sampleIds);
    }
  } else if (viewMode === 'team') {
    filtered = shots.filter(shot => shot.teamTricode === entityId);
    console.log(`🏀 Team filter: found ${filtered.length} shots for team ${entityId}`);
    if (filtered.length === 0) {
      // Debug: show sample of available team codes
      const sampleTeams = [...new Set(shots.slice(0, 100).map(s => s.teamTricode))].slice(0, 10);
      console.log('🔍 Sample team codes in data:', sampleTeams);
    }
  } else {
    filtered = shots;
  }
  
  return filtered;
}

function parseCsv(csvText: string): ShotData[] {
  const lines = csvText.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  
  // Create a mapping from header names to indices for more robust parsing
  const headerMap: { [key: string]: number } = {};
  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().replace(/"/g, '').trim();
    headerMap[cleanHeader] = index;
  });
  
  console.log('CSV Headers found:', Object.keys(headerMap));
  
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    
    // More robust field mapping to handle different CSV formats
    const personId = values[headerMap['person_id']] || 
                    values[headerMap['personid']] || 
                    values[headerMap['player_id']] ||
                    values[headerMap['playerid']] || '';
                    
    const teamTricode = values[headerMap['team_tricode']] || 
                       values[headerMap['teamtricode']] || 
                       values[headerMap['team_abbreviation']] ||
                       values[headerMap['team']] || '';
                       
    // Fix the shot result mapping - use 'shotresult' (lowercase) directly
    const shotResult = values[headerMap['shotresult']] || 
                      values[headerMap['shot_result']] || 
                      values[headerMap['shotmadeflag']] || 
                      values[headerMap['shot_made_flag']] || 
                      values[headerMap['made']] || 'Missed';
                        
    const locX = values[headerMap['loc_x']] || 
                values[headerMap['locx']] || 
                values[headerMap['x']] || 
                values[headerMap['xlegacy']] || '0';
                
    const locY = values[headerMap['loc_y']] || 
                values[headerMap['locy']] || 
                values[headerMap['y']] || 
                values[headerMap['ylegacy']] || '0';
                
    const shotDistance = values[headerMap['shot_distance']] || 
                        values[headerMap['shotdistance']] || 
                        values[headerMap['distance']] || '0';
                        
    const actionType = values[headerMap['action_type']] || 
                      values[headerMap['actiontype']] || 
                      values[headerMap['description']] || '';
                      
    const shotType = values[headerMap['shot_type']] || 
                    values[headerMap['shottype']] || 
                    values[headerMap['subtype']] || '';
    
    return {
      personId: personId.toString(),
      teamTricode: teamTricode,
      xLegacy: parseFloat(locX) || 0,
      yLegacy: parseFloat(locY) || 0,
      shotResult: shotResult, // This should now correctly map to "Made" or "Missed"
      shotDistance: parseFloat(shotDistance) || 0,
      description: actionType,
      subType: shotType,
      shotValue: parseInt(values[headerMap['shotvalue']]) || 
                 parseInt(values[headerMap['shot_value']]) || 
                 (shotType?.includes('3PT') ? 3 : 2)
    };
  }).filter(shot => shot.personId && shot.teamTricode); // Filter out invalid entries
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