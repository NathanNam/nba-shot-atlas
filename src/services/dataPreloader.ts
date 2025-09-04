import JSZip from 'jszip';
import { ShotData } from '@/hooks/useShotData';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

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

// Metrics
const dataLoadCounter = meter.createCounter('data_preloader_loads_total', {
  description: 'Total number of data loads',
});

const dataLoadDuration = meter.createHistogram('data_preloader_load_duration_ms', {
  description: 'Duration of data loading operations in milliseconds',
});

const csvParseCounter = meter.createCounter('data_preloader_csv_parses_total', {
  description: 'Total number of CSV parsing operations',
});

const csvParseDuration = meter.createHistogram('data_preloader_csv_parse_duration_ms', {
  description: 'Duration of CSV parsing operations in milliseconds',
});

const cacheOperationCounter = meter.createCounter('data_preloader_cache_operations_total', {
  description: 'Total number of cache operations',
});

const shotDataGauge = meter.createUpDownCounter('data_preloader_shot_data_count', {
  description: 'Current number of shot data records in cache',
});

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
  const span = tracer.startSpan('data_preloader.load_season_data', {
    attributes: {
      'data.season': season,
      'data.operation': 'load_season_data',
    },
  });

  const startTime = Date.now();
  const year = season.includes('-') ? season.split('-')[0] : season;

  try {
    dataLoadCounter.add(1, { season: season, year: year });

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Starting season data load',
      attributes: {
        season: season,
        year: year,
      },
    });

    // Try to load compressed version first
    const zipPath = `/data/nbastatsv3_${year}_enriched_shots.csv.zip`;
    span.addEvent('attempting_zip_load', { path: zipPath });

    const zipResponse = await fetch(zipPath);
    if (zipResponse.ok) {
      span.setAttributes({
        'data.source': 'zip',
        'data.file_path': zipPath,
        'http.status_code': zipResponse.status,
      });

      const zipArrayBuffer = await zipResponse.arrayBuffer();
      const zip = new JSZip();
      const zipFile = await zip.loadAsync(zipArrayBuffer);

      const csvFileName = `nbastatsv3_${year}_enriched_shots.csv`;
      const csvFile = zipFile.file(csvFileName);

      if (csvFile) {
        span.addEvent('extracting_csv_from_zip', { csv_filename: csvFileName });
        const csvText = await csvFile.async('text');

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Successfully loaded compressed data',
          attributes: {
            season: season,
            source: 'zip',
            csv_size_bytes: csvText.length,
          },
        });

        return parseCsv(csvText);
      }
    }
    
    // Fallback to uncompressed CSV
    const csvPath = `/data/nbastatsv3_${year}_enriched_shots.csv`;
    span.addEvent('attempting_csv_load', { path: csvPath });

    const csvResponse = await fetch(csvPath);
    if (csvResponse.ok) {
      span.setAttributes({
        'data.source': 'csv',
        'data.file_path': csvPath,
        'http.status_code': csvResponse.status,
      });

      const csvText = await csvResponse.text();

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Successfully loaded uncompressed data',
        attributes: {
          season: season,
          source: 'csv',
          csv_size_bytes: csvText.length,
        },
      });

      return parseCsv(csvText);
    }

    throw new Error(`Failed to load data for season ${season}`);
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `Error loading season data for ${season}`,
    });

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Error loading season data',
      attributes: {
        season: season,
        year: year,
        error: (error as Error).message,
      },
    });

    console.error(`Error loading season data for ${season}:`, error);
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    dataLoadDuration.record(duration, { season: season });

    span.setAttributes({
      'data.load_duration_ms': duration,
    });

    span.end();
  }
}

function parseCsv(csvText: string): ShotData[] {
  const span = tracer.startSpan('data_preloader.parse_csv', {
    attributes: {
      'data.operation': 'parse_csv',
      'data.csv_size_bytes': csvText.length,
    },
  });

  const startTime = Date.now();

  try {
    csvParseCounter.add(1);

    const lines = csvText.trim().split('\n');
    const headers = parseCsvLine(lines[0]);

    span.setAttributes({
      'data.total_lines': lines.length,
      'data.header_count': headers.length,
    });

    // Create a mapping from header names to indices for more robust parsing
    const headerMap: { [key: string]: number } = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toLowerCase().replace(/"/g, '').trim();
      headerMap[cleanHeader] = index;
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: 'CSV parsing started',
      attributes: {
        total_lines: lines.length,
        header_count: headers.length,
        headers: Object.keys(headerMap).slice(0, 10), // Log first 10 headers
      },
    });

    console.log('📊 CSV Headers found:', Object.keys(headerMap));
  
    const shotData = lines.slice(1).map(line => {
      const values = parseCsvLine(line);

      // More robust field mapping to handle different CSV formats
      const personId = values[headerMap['personid']] ||
                      values[headerMap['person_id']] ||
                      values[headerMap['player_id']] ||
                      values[headerMap['playerid']] || '';

      const teamTricode = values[headerMap['teamtricode']] ||
                         values[headerMap['team_tricode']] ||
                         values[headerMap['team_abbreviation']] ||
                         values[headerMap['team']] || '';

      // Fix the shot result mapping - use 'shotresult' (lowercase)
      const shotResult = values[headerMap['shotresult']] ||
                        values[headerMap['shot_result']] ||
                        values[headerMap['shotmadeflag']] ||
                        values[headerMap['shot_made_flag']] ||
                        values[headerMap['made']] || 'Missed';

      const locX = values[headerMap['xlegacy']] ||
                  values[headerMap['loc_x']] ||
                  values[headerMap['locx']] ||
                  values[headerMap['x']] || '0';

      const locY = values[headerMap['ylegacy']] ||
                  values[headerMap['loc_y']] ||
                  values[headerMap['locy']] ||
                  values[headerMap['y']] || '0';

      const shotDistance = values[headerMap['shotdistance']] ||
                          values[headerMap['shot_distance']] ||
                          values[headerMap['distance']] || '0';

      const actionType = values[headerMap['actiontype']] ||
                        values[headerMap['action_type']] ||
                        values[headerMap['description']] || '';

      const shotType = values[headerMap['subtype']] ||
                      values[headerMap['shot_type']] ||
                      values[headerMap['shottype']] || '';

      const shotValue = parseInt(values[headerMap['shotvalue']]) ||
                       parseInt(values[headerMap['shot_value']]) ||
                       (shotType?.includes('3PT') ? 3 : 2);

      return {
        personId: personId.toString(),
        teamTricode: teamTricode,
        xLegacy: parseFloat(locX) || 0,
        yLegacy: parseFloat(locY) || 0,
        shotResult: shotResult, // This should now correctly map to "Made" or "Missed"
        shotDistance: parseFloat(shotDistance) || 0,
        description: actionType,
        subType: shotType,
        shotValue: shotValue
      };
    }).filter(shot => shot.personId && shot.teamTricode); // Filter out invalid entries

    span.setAttributes({
      'data.parsed_records': shotData.length,
      'data.filtered_records': shotData.length,
    });

    shotDataGauge.add(shotData.length);

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'CSV parsing completed',
      attributes: {
        total_lines: lines.length,
        parsed_records: shotData.length,
        success_rate: shotData.length / (lines.length - 1), // Exclude header
      },
    });

    return shotData;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Error parsing CSV data',
    });

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Error parsing CSV data',
      attributes: {
        error: (error as Error).message,
        csv_size_bytes: csvText.length,
      },
    });

    throw error;
  } finally {
    const duration = Date.now() - startTime;
    csvParseDuration.record(duration);

    span.setAttributes({
      'data.parse_duration_ms': duration,
    });

    span.end();
  }
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
  const span = tracer.startSpan('data_preloader.apply_filter', {
    attributes: {
      'data.operation': 'apply_filter',
      'data.view_mode': viewMode,
      'data.entity_id': entityId,
      'data.input_shots': shots.length,
    },
  });

  try {
    // Log filtered data for debugging in preloader
    console.log(`🔍 Preloader filtering ${shots.length} shots: ${viewMode} = "${entityId}"`);

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: 'Applying data filter',
      attributes: {
        view_mode: viewMode,
        entity_id: entityId,
        input_shots: shots.length,
      },
    });

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

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: 'No shots found for player ID',
          attributes: {
            player_id: entityId,
            sample_player_ids: sampleIds,
          },
        });
      }
    } else if (viewMode === 'team') {
      filtered = shots.filter(shot => shot.teamTricode === entityId);
      console.log(`🏀 Preloader team filter: found ${filtered.length} shots for team ${entityId}`);
      if (filtered.length === 0) {
        // Debug: show sample of available team codes
        const sampleTeams = [...new Set(shots.slice(0, 50).map(s => s.teamTricode))].slice(0, 5);
        console.log('🔍 Sample team codes in preloader data:', sampleTeams);

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: 'No shots found for team',
          attributes: {
            team: entityId,
            sample_teams: sampleTeams,
          },
        });
      }
    } else {
      filtered = shots;
    }

    span.setAttributes({
      'data.output_shots': filtered.length,
      'data.filter_ratio': filtered.length / shots.length,
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: 'Filter applied successfully',
      attributes: {
        view_mode: viewMode,
        entity_id: entityId,
        input_shots: shots.length,
        output_shots: filtered.length,
        filter_ratio: filtered.length / shots.length,
      },
    });

    return filtered;
  } finally {
    span.end();
  }
}

async function preloadEntityData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const span = tracer.startSpan('data_preloader.preload_entity_data', {
    attributes: {
      'data.operation': 'preload_entity_data',
      'data.season': season,
      'data.entity_id': entityId,
      'data.view_mode': viewMode,
    },
  });

  const startTime = Date.now();
  const year = season.includes('-') ? season.split('-')[0] : season;
  const cacheKey = `${season}-${year}`;
  const filterKey = `${viewMode}-${entityId}`;

  try {
    // Check if data is already cached and fresh
    const cached = dataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < PRELOAD_CACHE_TTL)) {
      const filteredData = cached.filteredData.get(filterKey);
      if (filteredData) {
        cacheOperationCounter.add(1, { operation: 'hit', cache_key: cacheKey });

        span.setAttributes({
          'data.cache_hit': true,
          'data.cached_records': filteredData.length,
        });

        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Preload cache hit',
          attributes: {
            view_mode: viewMode,
            entity_id: entityId,
            season: season,
            cached_records: filteredData.length,
          },
        });

        console.log(`✅ Preload cache hit: ${viewMode} ${entityId} for ${season}`);
        return;
      }
    }
  
    cacheOperationCounter.add(1, { operation: 'miss', cache_key: cacheKey });

    console.log(`🔄 Preloading: ${viewMode} ${entityId} for ${season}`);

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Starting entity data preload',
      attributes: {
        view_mode: viewMode,
        entity_id: entityId,
        season: season,
        cache_key: cacheKey,
      },
    });

    // Load raw data if not cached or expired
    let rawData: ShotData[];
    if (cached && (Date.now() - cached.timestamp < PRELOAD_CACHE_TTL)) {
      rawData = cached.rawData;
      span.addEvent('using_cached_raw_data', { raw_data_size: rawData.length });
    } else {
      span.addEvent('loading_fresh_raw_data');
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

    span.setAttributes({
      'data.cache_hit': false,
      'data.raw_data_size': rawData.length,
      'data.filtered_data_size': filteredData.length,
    });

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Entity data preload completed',
      attributes: {
        view_mode: viewMode,
        entity_id: entityId,
        season: season,
        raw_data_size: rawData.length,
        filtered_data_size: filteredData.length,
      },
    });

    console.log(`✅ Preloaded: ${viewMode} ${entityId} for ${season} (${filteredData.length} shots)`);
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `Failed to preload: ${viewMode} ${entityId} for ${season}`,
    });

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Entity data preload failed',
      attributes: {
        view_mode: viewMode,
        entity_id: entityId,
        season: season,
        error: (error as Error).message,
      },
    });

    console.error(`❌ Failed to preload: ${viewMode} ${entityId} for ${season}`, error);
  } finally {
    const duration = Date.now() - startTime;
    span.setAttributes({
      'data.preload_duration_ms': duration,
    });

    span.end();
  }
}

export async function preloadDefaultData(): Promise<void> {
  const span = tracer.startSpan('data_preloader.preload_default_data', {
    attributes: {
      'data.operation': 'preload_default_data',
      'data.season': DEFAULT_PRELOAD_CONFIG.season,
      'data.entity_count': DEFAULT_PRELOAD_CONFIG.entities.length,
    },
  });

  const startTime = Date.now();

  try {
    console.log('🚀 Starting data preload for cold start optimization...');

    const { season, entities } = DEFAULT_PRELOAD_CONFIG;

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Starting default data preload',
      attributes: {
        season: season,
        entity_count: entities.length,
        entities: entities.map(e => ({ id: e.id, name: e.name, viewMode: e.viewMode })),
      },
    });

    // Preload all default entities in parallel
    const preloadPromises = entities.map(entity =>
      preloadEntityData(season, entity.id, entity.viewMode)
    );

    await Promise.all(preloadPromises);

    span.setAttributes({
      'data.preload_success': true,
    });

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Default data preload completed successfully',
      attributes: {
        season: season,
        entity_count: entities.length,
      },
    });

    console.log('✅ Data preload completed successfully');
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Data preload failed',
    });

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Default data preload failed',
      attributes: {
        error: (error as Error).message,
        season: DEFAULT_PRELOAD_CONFIG.season,
      },
    });

    console.error('❌ Data preload failed:', error);
  } finally {
    const duration = Date.now() - startTime;
    span.setAttributes({
      'data.total_preload_duration_ms': duration,
    });

    span.end();
  }
}

// Auto-start preloading when this module is imported
if (typeof window !== 'undefined') {
  // Start preloading after a short delay to not block initial render
  setTimeout(() => {
    preloadDefaultData();
  }, 100);
}