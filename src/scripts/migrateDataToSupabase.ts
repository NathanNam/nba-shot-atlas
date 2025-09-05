import { supabase } from "@/integrations/supabase/client";
import JSZip from 'jszip';

interface CSVShotData {
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

interface CSVPlayerData {
  id: string;
  name: string;
  team: string;
}

export class DataMigrator {
  private static async loadPlayersFromCSV(): Promise<CSVPlayerData[]> {
    try {
      const response = await fetch('/data/nba_players_2013_2025.csv');
      if (!response.ok) {
        throw new Error('Failed to load players CSV');
      }

      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',');
      
      return lines.slice(1).map(line => {
        const values = line.split(',');
        return {
          id: values[0],
          name: values[1],
          team: values[2] || '',
        };
      });
    } catch (error) {
      console.error('Error loading players CSV:', error);
      throw error;
    }
  }

  private static async loadShotDataFromCSV(season: string): Promise<CSVShotData[]> {
    try {
      const year = season.includes('-') ? season.split('-')[0] : season;
      let csvText = '';

      // Try loading compressed file first
      const zipPath = `/data/nbastatsv3_${year}_enriched_shots.csv.zip`;
      
      try {
        const zipResponse = await fetch(zipPath);
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
        const response = await fetch(csvPath);
        if (!response.ok) {
          throw new Error(`Failed to load data for ${season} (tried both .zip and .csv)`);
        }
        csvText = await response.text();
      }

      return this.parseShotCsv(csvText, season);
    } catch (error) {
      console.error(`Error loading shot data for ${season}:`, error);
      throw error;
    }
  }

  private static parseShotCsv(csvText: string, season: string): CSVShotData[] {
    const lines = csvText.trim().split('\n');
    const headers = this.parseCsvLine(lines[0]);
    
    // Create a mapping from header names to indices
    const headerMap: { [key: string]: number } = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.toLowerCase().replace(/"/g, '').trim();
      headerMap[cleanHeader] = index;
    });
    
    console.log(`Processing ${season} - Headers found:`, Object.keys(headerMap));
    
    return lines.slice(1).map(line => {
      const values = this.parseCsvLine(line);
      
      // Map fields from CSV to our interface
      const personId = values[headerMap['person_id']] || 
                      values[headerMap['personid']] || 
                      values[headerMap['player_id']] ||
                      values[headerMap['playerid']] || '';
                      
      const teamTricode = values[headerMap['team_tricode']] || 
                         values[headerMap['teamtricode']] || 
                         values[headerMap['team_abbreviation']] ||
                         values[headerMap['team']] || '';
                         
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
        shotResult: shotResult,
        shotDistance: parseFloat(shotDistance) || 0,
        description: actionType,
        subType: shotType,
        shotValue: parseInt(values[headerMap['shotvalue']]) || 
                   parseInt(values[headerMap['shot_value']]) || 
                   (shotType?.includes('3PT') ? 3 : 2)
      };
    }).filter(shot => shot.personId && shot.teamTricode);
  }

  private static parseCsvLine(line: string): string[] {
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

  static async migratePlayersToSupabase(): Promise<void> {
    console.log('🔄 Starting player migration to Supabase...');
    
    try {
      // Load players from CSV
      const players = await this.loadPlayersFromCSV();
      console.log(`📊 Loaded ${players.length} players from CSV`);

      // Check if players already exist
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });

      if (count && count > 0) {
        console.log(`⚠️  Players table already has ${count} records. Skipping migration.`);
        return;
      }

      // Insert players in batches
      const batchSize = 1000;
      for (let i = 0; i < players.length; i += batchSize) {
        const batch = players.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('players')
          .insert(batch);

        if (error) {
          console.error(`❌ Error inserting players batch ${i / batchSize + 1}:`, error);
          throw error;
        }

        console.log(`✅ Inserted players batch ${i / batchSize + 1}/${Math.ceil(players.length / batchSize)}`);
      }

      console.log('🎉 Player migration completed successfully!');
    } catch (error) {
      console.error('❌ Player migration failed:', error);
      throw error;
    }
  }

  static async migrateShotDataToSupabase(seasons: string[]): Promise<void> {
    console.log('🔄 Starting shot data migration to Supabase...');
    
    try {
      for (const season of seasons) {
        console.log(`📊 Processing season: ${season}`);

        // Check if this season already exists
        const { count } = await supabase
          .from('shots')
          .select('*', { count: 'exact', head: true })
          .eq('season', season);

        if (count && count > 0) {
          console.log(`⚠️  Season ${season} already has ${count} shots. Skipping.`);
          continue;
        }

        // Load shot data from CSV
        const shots = await this.loadShotDataFromCSV(season);
        console.log(`📈 Loaded ${shots.length} shots for season ${season}`);

        if (shots.length === 0) {
          console.log(`⚠️  No shots found for season ${season}. Skipping.`);
          continue;
        }

        // Convert to database format
        const shotsForDB = shots.map(shot => ({
          season,
          person_id: shot.personId,
          team_tricode: shot.teamTricode,
          x_legacy: shot.xLegacy,
          y_legacy: shot.yLegacy,
          shot_result: shot.shotResult,
          shot_distance: shot.shotDistance,
          description: shot.description,
          sub_type: shot.subType,
          shot_value: shot.shotValue,
        }));

        // Insert shots in batches
        const batchSize = 1000;
        for (let i = 0; i < shotsForDB.length; i += batchSize) {
          const batch = shotsForDB.slice(i, i + batchSize);
          
          const { error } = await supabase
            .from('shots')
            .insert(batch);

          if (error) {
            console.error(`❌ Error inserting shots batch ${i / batchSize + 1} for ${season}:`, error);
            throw error;
          }

          console.log(`✅ Inserted shots batch ${i / batchSize + 1}/${Math.ceil(shotsForDB.length / batchSize)} for ${season}`);
        }

        console.log(`🎉 Season ${season} migration completed!`);
      }

      console.log('🎉 All shot data migration completed successfully!');
    } catch (error) {
      console.error('❌ Shot data migration failed:', error);
      throw error;
    }
  }

  static async migrateAllData(): Promise<void> {
    console.log('🚀 Starting complete data migration to Supabase...');
    
    try {
      // First migrate players
      await this.migratePlayersToSupabase();

      // Then migrate shot data for all available seasons
      const seasons = ['2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
      await this.migrateShotDataToSupabase(seasons);

      console.log('🎉 Complete data migration finished successfully!');
    } catch (error) {
      console.error('❌ Complete data migration failed:', error);
      throw error;
    }
  }

  static async migratePlayersFromText(csvText: string): Promise<void> {
    console.log('🔄 Starting player migration from uploaded text...');
    
    try {
      // Parse CSV text
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',');
      
      const players = lines.slice(1).map(line => {
        const values = line.split(',');
        return {
          id: values[0],
          name: values[1],
          team: values[2] || '',
        };
      }).filter(player => player.id && player.name);

      console.log(`📊 Parsed ${players.length} players from uploaded CSV`);

      // Check if players already exist
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });

      if (count && count > 0) {
        console.log(`⚠️  Players table already has ${count} records. Skipping migration.`);
        return;
      }

      // Insert players in batches
      const batchSize = 1000;
      for (let i = 0; i < players.length; i += batchSize) {
        const batch = players.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('players')
          .insert(batch);

        if (error) {
          console.error(`❌ Error inserting players batch ${i / batchSize + 1}:`, error);
          throw error;
        }

        console.log(`✅ Inserted players batch ${i / batchSize + 1}/${Math.ceil(players.length / batchSize)}`);
      }

      console.log('🎉 Player migration from upload completed successfully!');
    } catch (error) {
      console.error('❌ Player migration from upload failed:', error);
      throw error;
    }
  }

  static async migrateShotDataFromText(csvText: string, season: string): Promise<void> {
    console.log(`🔄 Starting shot data migration from uploaded text for season ${season}...`);
    
    try {
      // Check if this season already exists
      const { count } = await supabase
        .from('shots')
        .select('*', { count: 'exact', head: true })
        .eq('season', season);

      if (count && count > 0) {
        console.log(`⚠️  Season ${season} already has ${count} shots. Skipping.`);
        return;
      }

      // Parse shot data from CSV
      const shots = this.parseShotCsv(csvText, season);
      console.log(`📈 Parsed ${shots.length} shots for season ${season}`);

      if (shots.length === 0) {
        console.log(`⚠️  No shots found for season ${season}. Skipping.`);
        return;
      }

      // Convert to database format
      const shotsForDB = shots.map(shot => ({
        season,
        person_id: shot.personId,
        team_tricode: shot.teamTricode,
        x_legacy: shot.xLegacy,
        y_legacy: shot.yLegacy,
        shot_result: shot.shotResult,
        shot_distance: shot.shotDistance,
        description: shot.description,
        sub_type: shot.subType,
        shot_value: shot.shotValue,
      }));

      // Insert shots in batches
      const batchSize = 1000;
      for (let i = 0; i < shotsForDB.length; i += batchSize) {
        const batch = shotsForDB.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('shots')
          .insert(batch);

        if (error) {
          console.error(`❌ Error inserting shots batch ${i / batchSize + 1} for ${season}:`, error);
          throw error;
        }

        console.log(`✅ Inserted shots batch ${i / batchSize + 1}/${Math.ceil(shotsForDB.length / batchSize)} for ${season}`);
      }

      console.log(`🎉 Season ${season} migration from upload completed!`);
    } catch (error) {
      console.error(`❌ Shot data migration from upload failed for ${season}:`, error);
      throw error;
    }
  }
}

// Helper function to run migration from browser console
(window as any).migrateData = DataMigrator.migrateAllData;