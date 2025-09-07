import { NBAAnalyticsMetrics } from './nbaAnalyticsMetrics';

/**
 * Integration service to initialize and use NBA analytics metrics
 * This ensures metrics are properly started and tracked
 */
export class MetricsIntegration {
  private static initialized = false;
  private static sessionStartTime: number = Date.now();

  /**
   * Initialize metrics tracking for the application
   */
  static initialize() {
    if (this.initialized) return;

    // Track initial session
    this.trackAppStart();
    
    // Set up periodic user satisfaction tracking
    this.setupPeriodicTracking();
    
    // Track a test feature usage to ensure metrics are working
    this.trackFeature('app_initialization', { environment: 'development' });
    
    this.initialized = true;
    console.log('🎯 NBA Analytics Metrics initialized with test metrics');
  }

  /**
   * Track application startup
   */
  private static trackAppStart() {
    const userAgent = navigator.userAgent;
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    
    // Determine if returning user (simple check)
    const isReturning = localStorage.getItem('nba_analytics_visited') === 'true';
    localStorage.setItem('nba_analytics_visited', 'true');

    NBAAnalyticsMetrics.trackUserSession(
      isReturning ? 'returning' : 'new',
      userAgent,
      viewport
    );
  }

  /**
   * Set up periodic tracking for ongoing metrics
   */
  private static setupPeriodicTracking() {
    // Track user satisfaction every 5 minutes
    setInterval(() => {
      const sessionDuration = Date.now() - this.sessionStartTime;
      const pageViews = parseInt(sessionStorage.getItem('nba_page_views') || '1');
      const bounceRate = pageViews === 1 ? 1.0 : 0.0;
      
      // Simple satisfaction score based on session duration and engagement
      const satisfactionScore = this.calculateSatisfactionScore(sessionDuration, pageViews);
      
      NBAAnalyticsMetrics.trackUserSatisfaction(
        satisfactionScore,
        sessionDuration,
        pageViews,
        bounceRate
      );
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Calculate satisfaction score based on engagement metrics
   */
  private static calculateSatisfactionScore(sessionDuration: number, pageViews: number): number {
    let score = 5; // Base score
    
    // Boost score for longer sessions
    if (sessionDuration > 300000) score += 2; // 5+ minutes
    else if (sessionDuration > 120000) score += 1; // 2+ minutes
    
    // Boost score for multiple interactions
    if (pageViews > 5) score += 2;
    else if (pageViews > 2) score += 1;
    
    return Math.min(10, Math.max(0, score));
  }

  /**
   * Track page view for satisfaction calculation
   */
  static trackPageView() {
    const currentViews = parseInt(sessionStorage.getItem('nba_page_views') || '0');
    sessionStorage.setItem('nba_page_views', (currentViews + 1).toString());
  }

  /**
   * Track feature usage with context
   */
  static trackFeature(featureName: string, context: Record<string, any> = {}) {
    NBAAnalyticsMetrics.trackFeatureUsage(featureName, context, true);
    this.trackPageView();
  }

  /**
   * Track content engagement
   */
  static trackContentEngagement(
    contentType: 'shot_chart' | 'statistics' | 'comparison' | 'league_data',
    entityType: 'player' | 'team' | 'league',
    entityName: string,
    season: string,
    startTime: number
  ) {
    const duration = Date.now() - startTime;
    NBAAnalyticsMetrics.trackContentEngagement(
      contentType,
      entityType,
      entityName,
      season,
      duration
    );
    this.trackPageView();
  }

  /**
   * Track comparisons
   */
  static trackComparison(
    type: 'player_vs_player' | 'season_vs_season' | 'team_vs_team',
    entity1: string,
    entity2: string,
    season1: string,
    season2?: string,
    dataPoints?: number
  ) {
    NBAAnalyticsMetrics.trackComparison(type, entity1, entity2, season1, season2, dataPoints);
    this.trackPageView();
  }

  /**
   * Track shot chart interactions
   */
  static trackShotChartInteraction(
    interactionType: 'hover' | 'click' | 'filter' | 'zoom' | 'export',
    context: {
      entityName: string;
      entityType: 'player' | 'team' | 'league';
      season: string;
      shotCount?: number;
      filterApplied?: string;
    }
  ) {
    NBAAnalyticsMetrics.trackShotChartInteraction(interactionType, context);
  }
}