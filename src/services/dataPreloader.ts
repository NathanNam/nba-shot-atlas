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
  
  // Create a mapping from header names to indices
  const headerMap: { [key: string]: number } = {};
  headers.forEach((header, index) => {
    headerMap[header.toLowerCase()] = index;
  });
  
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return {
      personId: values[headerMap['person_id']] || '',
      teamTricode: values[headerMap['team_tricode']] || '',
      xLegacy: parseFloat(values[headerMap['loc_x']]) || 0,
      yLegacy: parseFloat(values[headerMap['loc_y']]) || 0,
      shotResult: values[headerMap['shot_made_flag']] === '1' ? 'Made' : 'Missed',
      shotDistance: parseFloat(values[headerMap['shot_distance']]) || 0,
      description: values[headerMap['action_type']] || '',
      subType: values[headerMap['shot_type']] || '',
      shotValue: parseInt(values[headerMap['shot_type']]?.includes('3PT') ? '3' : '2') || 2
    };
  });
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
  if (viewMode === 'league') {
    return shots;
  } else if (viewMode === 'player') {
    return shots.filter(shot => shot.personId === entityId);
  } else if (viewMode === 'team') {
    return shots.filter(shot => shot.teamTricode === entityId);
  }
  return shots;
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