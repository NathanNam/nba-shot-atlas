import { meter } from '../otel-client';
import { structuredLogger } from '../utils/structuredLogger';

// Custom metrics for NBA Analytics features
class FeatureMetricsService {
  private static instance: FeatureMetricsService;
  
  // Feature usage counters
  private playerSelectionCounter: any;
  private teamSelectionCounter: any;
  private seasonChangeCounter: any;
  private viewModeChangeCounter: any;
  private shotChartInteractionCounter: any;
  private comparisonViewCounter: any;
  private statisticsViewCounter: any;
  private searchCounter: any;
  private filterCounter: any;
  private exportCounter: any;

  // Performance histograms for new features
  private chartRenderTimeHistogram: any;
  private searchLatencyHistogram: any;
  private comparisonLoadTimeHistogram: any;
  private dataProcessingTimeHistogram: any;

  // User engagement metrics
  private sessionDurationHistogram: any;
  private pageViewCounter: any;
  private featureUsagePerSessionHistogram: any;
  private userRetentionCounter: any;

  // Business metrics
  private topPlayersViewedCounter: any;
  private topTeamsViewedCounter: any;
  private popularSeasonsCounter: any;
  private featureAdoptionRateGauge: any;

  private constructor() {
    this.initializeMetrics();
  }

  static getInstance(): FeatureMetricsService {
    if (!FeatureMetricsService.instance) {
      FeatureMetricsService.instance = new FeatureMetricsService();
    }
    return FeatureMetricsService.instance;
  }

  private initializeMetrics() {
    if (!meter?.createCounter) {
      console.warn('Meter not available for custom metrics');
      return;
    }

    // Feature usage counters
    this.playerSelectionCounter = meter.createCounter('nba_player_selections_total', {
      description: 'Total number of player selections',
    });

    this.teamSelectionCounter = meter.createCounter('nba_team_selections_total', {
      description: 'Total number of team selections',
    });

    this.seasonChangeCounter = meter.createCounter('nba_season_changes_total', {
      description: 'Total number of season changes',
    });

    this.viewModeChangeCounter = meter.createCounter('nba_view_mode_changes_total', {
      description: 'Total number of view mode changes',
    });

    this.shotChartInteractionCounter = meter.createCounter('nba_shot_chart_interactions_total', {
      description: 'Total number of shot chart interactions',
    });

    this.comparisonViewCounter = meter.createCounter('nba_comparison_views_total', {
      description: 'Total number of comparison views',
    });

    this.statisticsViewCounter = meter.createCounter('nba_statistics_views_total', {
      description: 'Total number of statistics views',
    });

    this.searchCounter = meter.createCounter('nba_searches_total', {
      description: 'Total number of search operations',
    });

    this.filterCounter = meter.createCounter('nba_filters_applied_total', {
      description: 'Total number of filters applied',
    });

    this.exportCounter = meter.createCounter('nba_data_exports_total', {
      description: 'Total number of data exports',
    });

    // Performance histograms
    this.chartRenderTimeHistogram = meter.createHistogram('nba_chart_render_time_ms', {
      description: 'Time taken to render NBA charts in milliseconds',
    });

    this.searchLatencyHistogram = meter.createHistogram('nba_search_latency_ms', {
      description: 'Search operation latency in milliseconds',
    });

    this.comparisonLoadTimeHistogram = meter.createHistogram('nba_comparison_load_time_ms', {
      description: 'Time taken to load comparison views in milliseconds',
    });

    this.dataProcessingTimeHistogram = meter.createHistogram('nba_data_processing_time_ms', {
      description: 'Time taken to process NBA data in milliseconds',
    });

    // User engagement metrics
    this.sessionDurationHistogram = meter.createHistogram('nba_session_duration_ms', {
      description: 'User session duration in milliseconds',
    });

    this.pageViewCounter = meter.createCounter('nba_page_views_total', {
      description: 'Total number of page views',
    });

    this.featureUsagePerSessionHistogram = meter.createHistogram('nba_features_per_session', {
      description: 'Number of features used per session',
    });

    this.userRetentionCounter = meter.createCounter('nba_user_retention_events_total', {
      description: 'User retention events (return visits)',
    });

    // Business metrics
    this.topPlayersViewedCounter = meter.createCounter('nba_top_players_viewed_total', {
      description: 'Views of top NBA players',
    });

    this.topTeamsViewedCounter = meter.createCounter('nba_top_teams_viewed_total', {
      description: 'Views of top NBA teams',
    });

    this.popularSeasonsCounter = meter.createCounter('nba_popular_seasons_viewed_total', {
      description: 'Views of popular NBA seasons',
    });

    this.featureAdoptionRateGauge = meter.createUpDownCounter('nba_feature_adoption_rate', {
      description: 'Feature adoption rate as percentage',
    });
  }

  // Feature usage tracking methods
  trackPlayerSelection(playerId: string, playerName: string, season: string) {
    this.playerSelectionCounter?.add(1, {
      player_id: playerId,
      player_name: playerName,
      season,
    });

    // Track popular players
    if (this.isPopularPlayer(playerName)) {
      this.topPlayersViewedCounter?.add(1, {
        player_name: playerName,
        season,
      });
    }

    structuredLogger.logPlayerAction('player_selected', playerName, season, { player_id: playerId });
  }

  trackTeamSelection(teamId: string, teamName: string, season: string) {
    this.teamSelectionCounter?.add(1, {
      team_id: teamId,
      team_name: teamName,
      season,
    });

    // Track popular teams
    if (this.isPopularTeam(teamName)) {
      this.topTeamsViewedCounter?.add(1, {
        team_name: teamName,
        season,
      });
    }

    structuredLogger.info('Team selected', {
      component: 'TeamSelection',
      operation: 'team_selected',
      entityId: teamId,
      entityName: teamName,
      season,
    });
  }

  trackSeasonChange(fromSeason: string, toSeason: string) {
    this.seasonChangeCounter?.add(1, {
      from_season: fromSeason,
      to_season: toSeason,
    });

    // Track popular seasons
    if (this.isPopularSeason(toSeason)) {
      this.popularSeasonsCounter?.add(1, {
        season: toSeason,
      });
    }

    structuredLogger.info('Season changed', {
      component: 'SeasonSelector',
      operation: 'season_changed',
    }, { from_season: fromSeason, to_season: toSeason });
  }

  trackViewModeChange(fromMode: string, toMode: string) {
    this.viewModeChangeCounter?.add(1, {
      from_mode: fromMode,
      to_mode: toMode,
    });

    structuredLogger.info('View mode changed', {
      component: 'ViewModeSelector',
      operation: 'view_mode_changed',
    }, { from_mode: fromMode, to_mode: toMode });
  }

  trackShotChartInteraction(interactionType: string, entityName: string, season: string, shotCount?: number) {
    this.shotChartInteractionCounter?.add(1, {
      interaction_type: interactionType,
      entity_name: entityName,
      season,
    });

    structuredLogger.info('Shot chart interaction', {
      component: 'ShotChart',
      operation: interactionType,
      entityName,
      season,
    }, { shot_count: shotCount });
  }

  trackComparisonView(season1: string, season2: string, entityType: string, loadTime?: number) {
    this.comparisonViewCounter?.add(1, {
      season1,
      season2,
      entity_type: entityType,
    });

    if (loadTime && this.comparisonLoadTimeHistogram) {
      this.comparisonLoadTimeHistogram.record(loadTime, {
        entity_type: entityType,
      });
    }

    structuredLogger.info('Comparison view accessed', {
      component: 'ComparisonView',
      operation: 'comparison_loaded',
      viewMode: entityType,
    }, { season1, season2, load_time_ms: loadTime });
  }

  trackStatisticsView(entityType: string, entityId: string, season: string) {
    this.statisticsViewCounter?.add(1, {
      entity_type: entityType,
      entity_id: entityId,
      season,
    });

    structuredLogger.info('Statistics view accessed', {
      component: 'StatisticsView',
      operation: 'statistics_loaded',
      entityId,
      season,
      viewMode: entityType,
    });
  }

  // Performance tracking methods
  trackChartRenderTime(chartType: string, renderTime: number, dataPoints?: number) {
    this.chartRenderTimeHistogram?.record(renderTime, {
      chart_type: chartType,
    });

    structuredLogger.logPerformanceMetric('chart_render_time', renderTime, 'ms', {
      component: 'ChartRenderer',
      operation: 'render',
    }, { chart_type: chartType, data_points: dataPoints });
  }

  trackSearchLatency(searchType: string, latency: number, resultCount?: number) {
    this.searchLatencyHistogram?.record(latency, {
      search_type: searchType,
    });

    this.searchCounter?.add(1, {
      search_type: searchType,
    });

    structuredLogger.logPerformanceMetric('search_latency', latency, 'ms', {
      component: 'SearchService',
      operation: 'search',
    }, { search_type: searchType, result_count: resultCount });
  }

  trackDataProcessingTime(operation: string, processingTime: number, dataSize?: number) {
    this.dataProcessingTimeHistogram?.record(processingTime, {
      operation,
    });

    structuredLogger.logPerformanceMetric('data_processing_time', processingTime, 'ms', {
      component: 'DataProcessor',
      operation,
    }, { data_size: dataSize });
  }

  // User engagement tracking
  trackPageView(path: string) {
    this.pageViewCounter?.add(1, {
      path,
    });

    structuredLogger.info('Page viewed', {
      component: 'Navigation',
      operation: 'page_view',
    }, { path });
  }

  trackSessionDuration(duration: number) {
    this.sessionDurationHistogram?.record(duration);

    structuredLogger.info('Session ended', {
      component: 'SessionTracker',
      operation: 'session_end',
    }, { duration_ms: duration });
  }

  trackFeatureUsagePerSession(featureCount: number) {
    this.featureUsagePerSessionHistogram?.record(featureCount);

    structuredLogger.info('Session feature usage', {
      component: 'SessionTracker',
      operation: 'session_summary',
    }, { features_used: featureCount });
  }

  // Helper methods to identify popular entities
  private isPopularPlayer(playerName: string): boolean {
    const popularPlayers = ['LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo', 
                           'Luka Dončić', 'Jayson Tatum', 'Nikola Jokić', 'Joel Embiid'];
    return popularPlayers.includes(playerName);
  }

  private isPopularTeam(teamName: string): boolean {
    const popularTeams = ['GSW', 'LAL', 'BOS', 'MIA', 'CHI', 'NYK'];
    return popularTeams.includes(teamName);
  }

  private isPopularSeason(season: string): boolean {
    const popularSeasons = ['2023-24', '2022-23', '2021-22'];
    return popularSeasons.includes(season);
  }
}

// Export singleton instance
export const featureMetrics = FeatureMetricsService.getInstance();