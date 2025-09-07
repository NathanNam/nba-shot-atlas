import { trace, SpanStatusCode, metrics, Meter } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger } from '../otel-client';

/**
 * NBA Analytics Business Metrics Service
 * 
 * Tracks key business KPIs and user engagement metrics specific to NBA analytics
 */
export class NBAAnalyticsMetrics {
  private static meter: Meter;
  private static initialized = false;

  // Metrics will be initialized after OTEL is ready
  private static userSessionCounter: any;
  private static userEngagementDuration: any;
  private static contentViewCounter: any;
  private static featureUsageCounter: any;
  private static comparisonCounter: any;
  private static shotChartInteractionCounter: any;
  private static playerPopularityCounter: any;
  private static seasonPopularityCounter: any;
  private static dataVolumeHistogram: any;
  private static dataQualityGauge: any;
  private static userSatisfactionHistogram: any;
  private static apiRequestCounter: any;
  private static apiErrorCounter: any;
  private static apiRequestDuration: any;
  private static pageLoadTimeHistogram: any;
  private static domContentLoadedHistogram: any;

  /**
   * Initialize metrics after OTEL is ready
   */
  private static initializeMetrics() {
    if (this.initialized) {
      console.log('🎯 NBA metrics already initialized');
      return;
    }
    
    console.log('🎯 Initializing NBA metrics instruments...');
    // Import and use the global meter set by main.tsx
    import('../otel-client').then(({ globalMeter }) => {
      if (!globalMeter) {
        console.error('🎯 No global meter available - using fallback');
        this.meter = metrics.getMeter('hoops-analytics-viz');
      } else {
        console.log('🎯 Using global meter from otel-client');
        this.meter = globalMeter;
      }
      
      this.createMetrics();
    }).catch(error => {
      console.error('🎯 Error importing global meter:', error);
      // Fallback to global metrics API
      this.meter = metrics.getMeter('hoops-analytics-viz');
      this.createMetrics();
    });
  }

  private static createMetrics() {
    // User engagement metrics
    this.userSessionCounter = this.meter.createCounter('nba_user_sessions_total', {
      description: 'Total number of NBA analytics user sessions',
    });
    console.log('✅ Created userSessionCounter');

    this.userEngagementDuration = this.meter.createHistogram('nba_user_engagement_duration_ms', {
      description: 'Duration of user engagement with NBA content',
      unit: 'ms',
    });

    this.contentViewCounter = this.meter.createCounter('nba_content_views_total', {
      description: 'Total views of NBA content by type',
    });

    // Feature usage metrics
    this.featureUsageCounter = this.meter.createCounter('nba_feature_usage_total', {
      description: 'Usage count of NBA analytics features',
    });
    console.log('✅ Created featureUsageCounter');

    this.comparisonCounter = this.meter.createCounter('nba_comparisons_total', {
      description: 'Total number of NBA entity comparisons',
    });

    this.shotChartInteractionCounter = this.meter.createCounter('nba_shot_chart_interactions_total', {
      description: 'Total interactions with shot charts',
    });

    // Data insights metrics
    this.playerPopularityCounter = this.meter.createCounter('nba_player_views_total', {
      description: 'Total views per NBA player',
    });

    this.seasonPopularityCounter = this.meter.createCounter('nba_season_views_total', {
      description: 'Total views per NBA season',
    });

    this.dataVolumeHistogram = this.meter.createHistogram('nba_data_volume_processed', {
      description: 'Volume of NBA data processed (shots, statistics, etc)',
    });

    // Performance and quality metrics  
    this.dataQualityGauge = this.meter.createUpDownCounter('nba_data_quality_score', {
      description: 'Data quality score based on completeness and accuracy',
    });

    this.userSatisfactionHistogram = this.meter.createHistogram('nba_user_satisfaction_score', {
      description: 'User satisfaction scores based on interaction patterns',
    });

    // Application performance metrics
    this.apiRequestCounter = this.meter.createCounter('nba_api_requests_total', {
      description: 'Total number of API requests made by the application',
    });

    this.apiErrorCounter = this.meter.createCounter('nba_api_request_errors_total', {
      description: 'Total number of failed API requests',
    });

    this.apiRequestDuration = this.meter.createHistogram('nba_api_request_duration_ms', {
      description: 'Duration of API requests',
      unit: 'ms',
    });

    this.pageLoadTimeHistogram = this.meter.createHistogram('nba_page_load_time_ms', {
      description: 'Page load time from navigation start',
      unit: 'ms',
    });

    this.domContentLoadedHistogram = this.meter.createHistogram('nba_dom_content_loaded_ms', {
      description: 'Time until DOM content loaded event',
      unit: 'ms',
    });

    this.initialized = true;
    console.log('🎯 NBA Analytics Metrics instruments initialized successfully');
  }

  /**
   * Track user session start with NBA analytics context
   */
  static trackUserSession(sessionType: 'new' | 'returning', userAgent?: string, viewport?: string) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.user_session', {
      attributes: {
        'nba.session_type': sessionType,
        'nba.user_agent': userAgent || 'unknown',
        'nba.viewport': viewport || 'unknown',
        'nba.timestamp': Date.now(),
      },
    });

    try {
      this.userSessionCounter.add(1, {
        session_type: sessionType,
        platform: this.getPlatformFromUserAgent(userAgent),
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'NBA Analytics user session started',
        attributes: {
          session_type: sessionType,
          user_agent: userAgent,
          viewport: viewport,
          timestamp: new Date().toISOString(),
        },
      });

      span.setAttributes({
        'nba.session_tracked': true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track engagement with specific NBA content
   */
  static trackContentEngagement(
    contentType: 'shot_chart' | 'statistics' | 'comparison' | 'league_data',
    entityType: 'player' | 'team' | 'league',
    entityName: string,
    season: string,
    engagementDuration: number
  ) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.content_engagement', {
      attributes: {
        'nba.content_type': contentType,
        'nba.entity_type': entityType,
        'nba.entity_name': entityName,
        'nba.season': season,
        'nba.engagement_duration_ms': engagementDuration,
      },
    });

    try {
      this.contentViewCounter.add(1, {
        content_type: contentType,
        entity_type: entityType,
        season: season,
      });

      this.userEngagementDuration.record(engagementDuration, {
        content_type: contentType,
        entity_type: entityType,
        engagement_level: engagementDuration > 30000 ? 'high' : engagementDuration > 10000 ? 'medium' : 'low',
      });

      // Track player popularity
      if (entityType === 'player') {
        this.playerPopularityCounter.add(1, {
          player_name: entityName,
          season: season,
        });
      }

      // Track season popularity
      this.seasonPopularityCounter.add(1, {
        season: season,
        entity_type: entityType,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'NBA content engagement tracked',
        attributes: {
          content_type: contentType,
          entity_type: entityType,
          entity_name: entityName,
          season: season,
          engagement_duration_ms: engagementDuration,
          engagement_level: engagementDuration > 30000 ? 'high' : engagementDuration > 10000 ? 'medium' : 'low',
        },
      });

      span.setAttributes({
        'nba.engagement_tracked': true,
        'nba.engagement_level': engagementDuration > 30000 ? 'high' : engagementDuration > 10000 ? 'medium' : 'low',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track specific NBA feature usage
   */
  static trackFeatureUsage(
    featureName: string,
    featureContext: Record<string, any> = {},
    success: boolean = true
  ) {
    console.log('🎯 trackFeatureUsage called:', featureName);
    this.initializeMetrics();
    console.log('🎯 About to emit feature usage metric');
    const span = tracer.startSpan('nba_analytics.feature_usage', {
      attributes: {
        'nba.feature_name': featureName,
        'nba.feature_success': success,
        ...Object.fromEntries(Object.entries(featureContext).map(([k, v]) => [`nba.${k}`, v])),
      },
    });

    try {
      console.log('🎯 Calling featureUsageCounter.add()');
      this.featureUsageCounter.add(1, {
        feature_name: featureName,
        success: success ? 'true' : 'false',
      });
      console.log('🎯 Feature usage metric emitted successfully');

      logger.emit({
        severityNumber: success ? SeverityNumber.INFO : SeverityNumber.WARN,
        severityText: success ? 'INFO' : 'WARN',
        body: `NBA feature usage: ${featureName}`,
        attributes: {
          feature_name: featureName,
          success: success,
          ...featureContext,
          timestamp: new Date().toISOString(),
        },
      });

      span.setAttributes({
        'nba.feature_tracked': true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track NBA entity comparisons
   */
  static trackComparison(
    comparisonType: 'player_vs_player' | 'season_vs_season' | 'team_vs_team',
    entity1: string,
    entity2: string,
    season1: string,
    season2?: string,
    dataPoints?: number
  ) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.comparison', {
      attributes: {
        'nba.comparison_type': comparisonType,
        'nba.entity1': entity1,
        'nba.entity2': entity2,
        'nba.season1': season1,
        'nba.season2': season2 || season1,
        'nba.data_points': dataPoints || 0,
      },
    });

    try {
      this.comparisonCounter.add(1, {
        comparison_type: comparisonType,
        season1: season1,
        season2: season2 || season1,
      });

      if (dataPoints) {
        this.dataVolumeHistogram.record(dataPoints, {
          operation_type: 'comparison',
          comparison_type: comparisonType,
        });
      }

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'NBA comparison tracked',
        attributes: {
          comparison_type: comparisonType,
          entity1: entity1,
          entity2: entity2,
          season1: season1,
          season2: season2,
          data_points: dataPoints,
          timestamp: new Date().toISOString(),
        },
      });

      span.setAttributes({
        'nba.comparison_tracked': true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track shot chart interactions with detailed context
   */
  static trackShotChartInteraction(
    interactionType: 'hover' | 'click' | 'filter' | 'zoom' | 'export',
    chartContext: {
      entityName: string;
      entityType: 'player' | 'team' | 'league';
      season: string;
      shotCount?: number;
      filterApplied?: string;
    }
  ) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.shot_chart_interaction', {
      attributes: {
        'nba.interaction_type': interactionType,
        'nba.entity_name': chartContext.entityName,
        'nba.entity_type': chartContext.entityType,
        'nba.season': chartContext.season,
        'nba.shot_count': chartContext.shotCount || 0,
        'nba.filter_applied': chartContext.filterApplied || 'none',
      },
    });

    try {
      this.shotChartInteractionCounter.add(1, {
        interaction_type: interactionType,
        entity_type: chartContext.entityType,
        season: chartContext.season,
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'Shot chart interaction tracked',
        attributes: {
          interaction_type: interactionType,
          ...chartContext,
          timestamp: new Date().toISOString(),
        },
      });

      span.setAttributes({
        'nba.interaction_tracked': true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track API request performance and results
   */
  static trackApiRequest(endpoint: string, method: string, status: number, duration: number) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.api_request', {
      attributes: {
        'http.url': endpoint,
        'http.method': method,
        'http.status_code': status,
        'http.duration_ms': duration,
      },
    });

    try {
      this.apiRequestCounter.add(1, {
        endpoint,
        method,
        status: status.toString(),
      });

      this.apiRequestDuration.record(duration, {
        endpoint,
        method,
        status: status.toString(),
      });

      if (status >= 400 || status === 0) {
        this.apiErrorCounter.add(1, {
          endpoint,
          method,
          status: status.toString(),
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: 'API request failed',
          attributes: {
            endpoint,
            method,
            status,
            duration_ms: duration,
          },
        });
      }
    } finally {
      span.end();
    }
  }

  /**
   * Track initial page load metrics
   */
  static trackPageLoad(loadTime: number, domContentLoaded: number) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.page_load', {
      attributes: {
        'page.load_time_ms': loadTime,
        'page.dom_content_loaded_ms': domContentLoaded,
      },
    });

    try {
      this.pageLoadTimeHistogram.record(loadTime);
      this.domContentLoadedHistogram.record(domContentLoaded);

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Page load metrics tracked',
        attributes: {
          load_time_ms: loadTime,
          dom_content_loaded_ms: domContentLoaded,
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track data quality metrics
   */
  static trackDataQuality(
    dataType: 'shot_data' | 'player_info' | 'statistics',
    qualityScore: number, // 0-100
    completenessPercentage: number,
    dataSize: number
  ) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.data_quality', {
      attributes: {
        'nba.data_type': dataType,
        'nba.quality_score': qualityScore,
        'nba.completeness_percentage': completenessPercentage,
        'nba.data_size': dataSize,
      },
    });

    try {
      this.dataQualityGauge.add(qualityScore, {
        data_type: dataType,
        quality_tier: qualityScore > 80 ? 'high' : qualityScore > 60 ? 'medium' : 'low',
      });

      this.dataVolumeHistogram.record(dataSize, {
        operation_type: 'quality_check',
        data_type: dataType,
      });

      if (qualityScore < 70) {
        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: 'Low data quality detected',
          attributes: {
            data_type: dataType,
            quality_score: qualityScore,
            completeness_percentage: completenessPercentage,
            data_size: dataSize,
          },
        });
      }

      span.setAttributes({
        'nba.quality_tracked': true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Track user satisfaction based on interaction patterns
   */
  static trackUserSatisfaction(
    satisfactionScore: number, // 0-10
    sessionDuration: number,
    pageViews: number,
    bounceRate: number
  ) {
    this.initializeMetrics();
    const span = tracer.startSpan('nba_analytics.user_satisfaction', {
      attributes: {
        'nba.satisfaction_score': satisfactionScore,
        'nba.session_duration_ms': sessionDuration,
        'nba.page_views': pageViews,
        'nba.bounce_rate': bounceRate,
      },
    });

    try {
      this.userSatisfactionHistogram.record(satisfactionScore, {
        satisfaction_level: satisfactionScore > 7 ? 'high' : satisfactionScore > 4 ? 'medium' : 'low',
        session_length: sessionDuration > 300000 ? 'long' : sessionDuration > 60000 ? 'medium' : 'short',
      });

      logger.emit({
        severityNumber: satisfactionScore < 4 ? SeverityNumber.WARN : SeverityNumber.INFO,
        severityText: satisfactionScore < 4 ? 'WARN' : 'INFO',
        body: 'User satisfaction tracked',
        attributes: {
          satisfaction_score: satisfactionScore,
          session_duration_ms: sessionDuration,
          page_views: pageViews,
          bounce_rate: bounceRate,
          satisfaction_level: satisfactionScore > 7 ? 'high' : satisfactionScore > 4 ? 'medium' : 'low',
        },
      });

      span.setAttributes({
        'nba.satisfaction_tracked': true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Helper method to extract platform from user agent
   */
  private static getPlatformFromUserAgent(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    if (userAgent.includes('iPad')) return 'tablet';
    if (userAgent.includes('Android')) return 'mobile';
    if (userAgent.includes('iPhone')) return 'mobile';
    
    return 'desktop';
  }
}