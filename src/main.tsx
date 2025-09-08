import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DataPreloader } from "@/services/dataPreloader";
import App from "./App";
import "./index.css";

// Force clear caches first
import "./utils/forceCacheClear";

// Defer OpenTelemetry initialization until after app loads
const initializeAnalytics = async () => {
  // Dynamic imports to avoid loading telemetry code in initial bundle
  const [{ initOtel }, { MetricsIntegration }] = await Promise.all([
    import("./otel-client"),
    import("./services/metricsIntegration")
  ]);
  return initOtel().then(async ({ tracer, logger, meter }) => {
    console.log('✅ OpenTelemetry initialized successfully');
    console.log('✅ OTEL Components ready:', { tracer: !!tracer, logger: !!logger, meter: !!meter });
    
    // Set global meter for NBA metrics
    const { setGlobalMeter } = await import('./otel-client');
    setGlobalMeter(meter);
    console.log('✅ Global meter set for NBA metrics');
  
  // Initialize NBA Analytics metrics tracking
  MetricsIntegration.initialize();
  
  // Test NBA metrics immediately using the same pattern as the working nba_test_metric
  console.log('🧪 Creating all NBA metrics using the working meter...');
  
  // Create ALL NBA metrics directly using the working meter (same as nba_test_metric)
  // User engagement metrics
  const nbaUserSessionsCounter = meter.createCounter('nba_user_sessions_total', {
    description: 'Total number of NBA analytics user sessions'
  });
  
  const nbaUserEngagementDuration = meter.createHistogram('nba_user_engagement_duration_ms', {
    description: 'Duration of user engagement with NBA content',
    unit: 'ms'
  });
  
  const nbaContentViewCounter = meter.createCounter('nba_content_views_total', {
    description: 'Total views of NBA content by type'
  });
  
  // Feature usage metrics
  const nbaFeatureUsageCounter = meter.createCounter('nba_feature_usage_total', {
    description: 'Usage count of NBA analytics features'
  });
  
  const nbaComparisonsCounter = meter.createCounter('nba_comparisons_total', {
    description: 'Total number of NBA entity comparisons'
  });
  
  const nbaShotChartInteractionCounter = meter.createCounter('nba_shot_chart_interactions_total', {
    description: 'Total interactions with shot charts'
  });
  
  // Data insights metrics
  const nbaPlayerPopularityCounter = meter.createCounter('nba_player_views_total', {
    description: 'Total views per NBA player'
  });
  
  const nbaSeasonPopularityCounter = meter.createCounter('nba_season_views_total', {
    description: 'Total views per NBA season'
  });
  
  const nbaDataVolumeHistogram = meter.createHistogram('nba_data_volume_processed', {
    description: 'Volume of NBA data processed (shots, statistics, etc)'
  });
  
  // Performance and quality metrics
  const nbaDataQualityGauge = meter.createUpDownCounter('nba_data_quality_score', {
    description: 'Data quality score based on completeness and accuracy'
  });
  
  const nbaUserSatisfactionHistogram = meter.createHistogram('nba_user_satisfaction_score', {
    description: 'User satisfaction scores based on interaction patterns'
  });
  
  // Application performance metrics
  const nbaApiRequestCounter = meter.createCounter('nba_api_requests_total', {
    description: 'Total number of API requests made by the application'
  });
  
  const nbaApiErrorCounter = meter.createCounter('nba_api_request_errors_total', {
    description: 'Total number of failed API requests'
  });
  
  const nbaApiRequestDuration = meter.createHistogram('nba_api_request_duration_ms', {
    description: 'Duration of API requests',
    unit: 'ms'
  });
  
  const nbaPageLoadTimeHistogram = meter.createHistogram('nba_page_load_time_ms', {
    description: 'Page load time from navigation start',
    unit: 'ms'
  });
  
  const nbaDomContentLoadedHistogram = meter.createHistogram('nba_dom_content_loaded_ms', {
    description: 'Time until DOM content loaded event',
    unit: 'ms'
  });
  
  // Emit test data for each metric (same pattern as nba_test_metric)
  console.log('🧪 Emitting test data for all NBA metrics...');
  
  // Counters
  nbaUserSessionsCounter.add(1, { session_type: 'new', test: 'true' });
  nbaContentViewCounter.add(1, { content_type: 'shot_chart', test: 'true' });
  nbaFeatureUsageCounter.add(1, { feature: 'otel_ready_test', test: 'true' });
  nbaComparisonsCounter.add(1, { comparison_type: 'player_vs_player', test: 'true' });
  nbaShotChartInteractionCounter.add(1, { interaction_type: 'click', test: 'true' });
  nbaPlayerPopularityCounter.add(1, { player_name: 'LeBron James', test: 'true' });
  nbaSeasonPopularityCounter.add(1, { season: '2023-24', test: 'true' });
  nbaApiRequestCounter.add(1, { endpoint: '/test', test: 'true' });
  nbaApiErrorCounter.add(1, { endpoint: '/test', test: 'true' });
  
  // Histograms
  nbaUserEngagementDuration.record(5000, { content_type: 'shot_chart', test: 'true' });
  nbaDataVolumeHistogram.record(150, { operation_type: 'test', test: 'true' });
  nbaUserSatisfactionHistogram.record(8, { satisfaction_level: 'high', test: 'true' });
  nbaApiRequestDuration.record(250, { endpoint: '/test', test: 'true' });
  nbaPageLoadTimeHistogram.record(1500, { test: 'true' });
  nbaDomContentLoadedHistogram.record(800, { test: 'true' });
  
  // UpDownCounter (gauge)
  nbaDataQualityGauge.add(85, { data_type: 'shot_data', test: 'true' });
  
    console.log('🧪 All NBA metrics test data emitted successfully');
  }).catch(error => {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
  });
};

// Initialize analytics after a short delay to allow app to load first
setTimeout(() => {
  initializeAnalytics().catch(error => {
    console.error('❌ Failed to initialize analytics:', error);
  });
}, 100);

// Preloading disabled for now to troubleshoot caching issues
// setTimeout(() => {
//   DataPreloader.preloadDefaultData().then(() => {
//     console.log('🚀 Default data preloading completed');
//   }).catch(error => {
//     console.error('🚀 Error preloading default data:', error);
//   });
// }, 200);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);