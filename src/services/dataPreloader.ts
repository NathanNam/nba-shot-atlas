import JSZip from 'jszip';
import { ShotData } from '@/hooks/useShotData';

// Default entities to preload for cold start optimization
const DEFAULT_PRELOAD_CONFIG = {
  season: '2024-25',
  entities: [
    { id: '201939', name: 'Stephen Curry', viewMode: 'player' as const },
    { id: 'GSW', name: 'GSW', viewMode: 'team' as const },
    { id: '', name: 'League', viewMode: 'league' as const }
  ]
};

// Extended cache TTL for preloaded data (30 minutes)
const PRELOAD_CACHE_TTL = 30 * 60 * 1000;

// Access the same global cache from useShotData
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
if (!window.__NBA_DATA_CACHE__) {
  window.__NBA_DATA_CACHE__ = new Map();
}

const dataCache = window.__NBA_DATA_CACHE__;

async function loadSeasonData(season: string): Promise<ShotData[]> {
  const year = season.includes('-') ? season.split('-')[0] : season;
  
  try {
    // Try to load compressed version first
    const zipResponse = await fetch(`/data/nbastatsv3_${year}_enriched_shots.csv.zip`);
    if (zipResponse.ok) {
      const zipArrayBuffer = await zipResponse.arrayBuffer();
      const zip = new JSZip();
      const zipFile = await zip.loadAsync(zipArrayBuffer);
      
      const csvFileName = `nbastatsv3_${year}_enriched_shots.csv`;
      const csvFile = zipFile.file(csvFileName);
      
      if (csvFile) {
        const csvText = await csvFile.async('text');
        return parseCsv(csvText);
      }
    }
    
    // Fallback to uncompressed CSV
    const csvResponse = await fetch(`/data/nbastatsv3_${year}_enriched_shots.csv`);
    if (csvResponse.ok) {
      const csvText = await csvResponse.text();
      return parseCsv(csvText);
    }
    
    throw new Error(`Failed to load data for season ${season}`);
  } catch (error) {
    console.error(`Error loading season data for ${season}:`, error);
    throw error;
  }
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
  
  console.log('📊 CSV Headers found:', Object.keys(headerMap));
  
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
                       
    const shotMadeFlag = values[headerMap['shot_made_flag']] || 
                        values[headerMap['shotmadeflag']] || 
                        values[headerMap['made']] || '0';
                        
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
      shotResult: shotMadeFlag === '1' ? 'Made' : 'Missed',
      shotDistance: parseFloat(shotDistance) || 0,
      description: actionType,
      subType: shotType,
      shotValue: shotType?.includes('3PT') ? 3 : 2
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
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function applyFilter(shots: ShotData[], viewMode: 'player' | 'team' | 'league', entityId: string): ShotData[] {
  // Log filtered data for debugging in preloader
  console.log(`🔍 Preloader filtering ${shots.length} shots: ${viewMode} = "${entityId}"`);
  
  let filtered: ShotData[];
  if (viewMode === 'league') {
    filtered = shots;
  } else if (viewMode === 'player') {
    filtered = shots.filter(shot => shot.personId === entityId);
    console.log(`👤 Preloader player filter: found ${filtered.length} shots for ID ${entityId}`);
    if (filtered.length === 0) {
      // Debug: show sample of available player IDs
      const sampleIds = [...new Set(shots.slice(0, 50).map(s => s.personId))].slice(0, 5);
      console.log('🔍 Sample player IDs in preloader data:', sampleIds);
    }
  } else if (viewMode === 'team') {
    filtered = shots.filter(shot => shot.teamTricode === entityId);
    console.log(`🏀 Preloader team filter: found ${filtered.length} shots for team ${entityId}`);
    if (filtered.length === 0) {
      // Debug: show sample of available team codes
      const sampleTeams = [...new Set(shots.slice(0, 50).map(s => s.teamTricode))].slice(0, 5);
      console.log('🔍 Sample team codes in preloader data:', sampleTeams);
    }
  } else {
    filtered = shots;
  }
  
  return filtered;
}

async function preloadEntityData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const year = season.includes('-') ? season.split('-')[0] : season;
  const cacheKey = `${season}-${year}`;
  const filterKey = `${viewMode}-${entityId}`;
  
  // Check if data is already cached and fresh
  const cached = dataCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < PRELOAD_CACHE_TTL)) {
    const filteredData = cached.filteredData.get(filterKey);
    if (filteredData) {
      console.log(`✅ Preload cache hit: ${viewMode} ${entityId} for ${season}`);
      return;
    }
  }
  
  try {
    console.log(`🔄 Preloading: ${viewMode} ${entityId} for ${season}`);
    
    // Load raw data if not cached or expired
    let rawData: ShotData[];
    if (cached && (Date.now() - cached.timestamp < PRELOAD_CACHE_TTL)) {
      rawData = cached.rawData;
    } else {
      rawData = await loadSeasonData(season);
      dataCache.set(cacheKey, {
        rawData,
        filteredData: new Map(),
        timestamp: Date.now()
      });
    }
    
    // Filter and cache the specific entity data
    const filteredData = applyFilter(rawData, viewMode, entityId);
    const cacheEntry = dataCache.get(cacheKey)!;
    cacheEntry.filteredData.set(filterKey, filteredData);
    
    console.log(`✅ Preloaded: ${viewMode} ${entityId} for ${season} (${filteredData.length} shots)`);
  } catch (error) {
    console.error(`❌ Failed to preload: ${viewMode} ${entityId} for ${season}`, error);
  }
}

export async function preloadDefaultData(): Promise<void> {
  console.log('🚀 Starting data preload for cold start optimization...');
  
  const { season, entities } = DEFAULT_PRELOAD_CONFIG;
  
  // Preload all default entities in parallel
  const preloadPromises = entities.map(entity => 
    preloadEntityData(season, entity.id, entity.viewMode)
  );
  
  try {
    await Promise.all(preloadPromises);
    console.log('✅ Data preload completed successfully');
  } catch (error) {
    console.error('❌ Data preload failed:', error);
  }
}

// Auto-start preloading when this module is imported
if (typeof window !== 'undefined') {
  // Start preloading after a short delay to not block initial render
  setTimeout(() => {
    preloadDefaultData();
  }, 100);
}