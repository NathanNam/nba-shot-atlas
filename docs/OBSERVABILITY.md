# NBA Analytics Dashboard - OpenTelemetry Observability

This document describes the comprehensive observability implementation in the NBA Analytics Dashboard using OpenTelemetry.

## 🎯 Overview

The application features production-ready observability with:

- **Distributed Tracing**: Full request tracing across components and services
- **Structured Logging**: Correlated logs with trace and span IDs
- **Metrics Collection**: Business and technical metrics with Prometheus export
- **Performance Monitoring**: Core Web Vitals, memory leak detection, and component performance
- **Error Tracking**: Comprehensive error handling with automatic recovery
- **User Analytics**: NBA-specific business metrics and user behavior tracking

## 🏗️ Architecture

### Core Components

1. **OpenTelemetry Client** (`src/otel-client.ts`)
   - Centralized OTEL configuration
   - Tracer, Logger, and Meter providers
   - Dynamic configuration via Supabase Edge Function
   - Environment-specific sampling strategies

2. **Performance Monitoring** (`src/components/PerformanceMonitor.tsx`)
   - Core Web Vitals (LCP, FID, CLS)
   - Memory leak detection
   - Component lifecycle tracking
   - Long task monitoring

3. **Error Boundaries** (`src/components/ErrorBoundary.tsx`)
   - Enhanced error context capture
   - User session correlation
   - Component tree analysis
   - Recovery mechanisms

4. **Custom Hooks**
   - `useComponentPerformance`: Advanced React component performance tracking
   - `useErrorTracking`: Structured error handling and recovery
   - `useNBAAnalyticsTracking`: Business-specific user behavior tracking

5. **Enhanced Services**
   - `NBAService`: Comprehensive API monitoring with retry logic
   - `NBAAnalyticsMetrics`: Business metrics collection
   - `MetricsIntegration`: Metrics aggregation and export

## 📊 Metrics Collected

### Technical Metrics

#### Performance Metrics
- `component_render_duration_ms`: Component render times
- `page_load_duration_ms`: Page load performance
- `api_call_duration_ms`: API response times
- `memory_usage_mb`: Memory consumption tracking
- `core_web_vitals_score`: LCP, FID, CLS measurements

#### Error Metrics
- `react_errors_total`: React component errors
- `react_error_recoveries_total`: Error recovery attempts
- `memory_leaks_detected_total`: Memory leak detection
- `api_errors_total`: API call failures

#### User Interaction Metrics
- `user_actions_total`: User interaction counts
- `user_session_duration_ms`: Session length tracking
- `navigation_events_total`: Page navigation events

### Business Metrics

#### NBA Analytics Specific
- `nba_user_sessions_total`: User session counts
- `nba_content_views_total`: Content engagement tracking
- `nba_player_views_total`: Player popularity metrics
- `nba_comparisons_total`: Comparison feature usage
- `nba_shot_chart_interactions_total`: Shot chart interactions

#### Data Quality Metrics
- `nba_data_quality_score`: Data completeness and accuracy
- `nba_api_cache_hits_total`: Cache efficiency
- `nba_api_requests_total`: API usage patterns

## 🔧 Configuration

### Environment Variables

```env
# OpenTelemetry Configuration
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
VITE_OTEL_EXPORTER_OTLP_BEARER_TOKEN=your_token_here
VITE_OTEL_SAMPLING_RATE=1.0

# Service Configuration
VITE_SERVICE_NAME=hoops-analytics-viz
VITE_SERVICE_VERSION=1.0.0
```

### Supabase Edge Function

The application fetches OTEL configuration dynamically via Supabase Edge Function at:
`https://icfqngdeohzzjvzcmawo.supabase.co/functions/v1/get-otel-config`

### Sampling Strategies

- **Development**: `AlwaysOnSampler` (100% sampling)
- **Production**: `ParentBasedSampler` with 10% rate limiting
- **Preview**: Configurable via environment variable

## 📈 Using the Observability Features

### Component Performance Tracking

```tsx
import { useComponentPerformance } from '@/hooks/useComponentPerformance';

function MyComponent() {
  const {
    trackRender,
    startMeasurement,
    isPerformingPoorly,
    memoryUsage,
    averageRenderTime
  } = useComponentPerformance({
    componentName: 'MyComponent',
    trackMemory: true,
    slowRenderThreshold: 50,
    enableDetailedTracking: true,
  });

  const handleComplexOperation = () => {
    const endMeasurement = startMeasurement('complex_operation');
    // ... complex logic
    endMeasurement();
  };

  return (
    <div>
      {isPerformingPoorly && <PerformanceWarning />}
      <div>Memory: {memoryUsage}MB</div>
      <div>Avg render: {averageRenderTime}ms</div>
    </div>
  );
}
```

### Error Tracking

```tsx
import { useErrorTracking } from '@/hooks/useErrorTracking';

function MyComponent() {
  const { trackError, createErrorBoundary, attemptRecovery } = useErrorTracking({
    autoCapture: true,
    enableRecovery: true,
    maxRecoveryAttempts: 3,
  });

  const handleApiCall = async () => {
    try {
      const result = await createErrorBoundary(
        () => fetch('/api/data'),
        { component: 'MyComponent', function: 'handleApiCall' }
      );
      return result;
    } catch (error) {
      const errorId = trackError(error as Error, {
        userAction: 'api_call',
        customContext: { endpoint: '/api/data' }
      });
      
      const recovered = await attemptRecovery(errorId);
      if (!recovered) {
        throw error;
      }
    }
  };
}
```

### NBA Analytics Tracking

```tsx
import { useNBAAnalyticsTracking } from '@/components/UserInteractionTracker';

function PlayerView() {
  const {
    trackPlayerSelection,
    trackShotChartInteraction,
    trackComparisonView
  } = useNBAAnalyticsTracking();

  const handlePlayerSelect = (playerId: string, playerName: string) => {
    trackPlayerSelection(playerId, playerName, '2023-24');
  };

  const handleShotChartClick = (shotData: any) => {
    trackShotChartInteraction('click', {
      entityName: 'LeBron James',
      entityType: 'player',
      season: '2023-24',
      shotCount: shotData.length,
    });
  };
}
```

### Enhanced API Service

```tsx
import { NBAService } from '@/services/nba-service';

// Comprehensive API monitoring with retry logic
const response = await NBAService.executeApiCall({
  endpoint: 'commonplayerinfo',
  method: 'GET',
  timeout: 15000,
  retries: 3,
  cacheKey: `player_${playerId}`,
  cacheTTL: 300000, // 5 minutes
});

console.log('Data quality score:', response.dataQualityScore);
console.log('Cache hit:', response.cached);
console.log('Retry count:', response.retryCount);
```

## 🏥 Health Monitoring

### Core Web Vitals Thresholds

- **LCP (Largest Contentful Paint)**
  - Good: ≤ 2.5s
  - Needs Improvement: 2.5s - 4.0s
  - Poor: > 4.0s

- **FID (First Input Delay)**
  - Good: ≤ 100ms
  - Needs Improvement: 100ms - 300ms
  - Poor: > 300ms

- **CLS (Cumulative Layout Shift)**
  - Good: ≤ 0.1
  - Needs Improvement: 0.1 - 0.25
  - Poor: > 0.25

### Memory Leak Detection

- **Growth Rate**: > 5MB/minute triggers warning
- **Memory Pressure**: > 80% of heap limit triggers alert
- **Critical Threshold**: > 90% of heap limit triggers error

### Performance Alerts

- **Slow Renders**: > 50ms render time triggers warning
- **Long Tasks**: > 50ms main thread blocking
- **API Timeouts**: > 15s request duration
- **High Error Rates**: > 5% error rate in sliding window

## 🔍 Debugging Tools

### Development Mode

In development, access debugging tools via browser console:

```javascript
// Session information
__NBA_ANALYTICS_DEBUG__.sessionInfo()

// Performance information
__NBA_ANALYTICS_DEBUG__.performanceInfo()

// Clear session data
__NBA_ANALYTICS_DEBUG__.clearSession()
```

### Error Context

Enhanced error boundaries provide:
- Error categorization (network, authorization, rendering, etc.)
- Component stack analysis
- Session context correlation
- User interaction history
- Viewport and device information

### Performance Monitoring

Real-time performance indicators show:
- Current memory usage
- Average render times
- Performance degradation alerts
- Core Web Vitals scores

## 📊 Dashboards and Alerting

### Recommended Observability Stack

1. **OpenTelemetry Collector**: Metrics and trace aggregation
2. **Prometheus**: Metrics storage and alerting
3. **Jaeger**: Distributed tracing visualization
4. **Grafana**: Metrics dashboards and alerting
5. **AlertManager**: Alert routing and management

### Key Dashboard Panels

#### Application Health
- Error rates and types
- Performance percentiles
- Core Web Vitals trends
- Memory usage patterns

#### Business Metrics
- User engagement metrics
- Feature adoption rates
- Content popularity
- Comparison usage patterns

#### Infrastructure
- API response times
- Cache hit rates
- Data quality scores
- Service availability

## 🚀 Production Considerations

### Performance Impact
- Sampling configured to minimize overhead
- Asynchronous metric collection
- Efficient memory management
- Non-blocking instrumentation

### Privacy and Security
- No PII in logs or traces
- Session IDs are anonymous
- Data sanitization in error contexts
- Secure token management

### Scalability
- Configurable sampling rates
- Efficient data aggregation
- Resource-aware monitoring
- Graceful degradation

## 📚 Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [React Performance Best Practices](https://react.dev/learn/render-and-commit)
- [NBA API Documentation](https://stats.nba.com/help/glossary/)

## 🤝 Contributing

When adding new observability features:

1. Follow OpenTelemetry semantic conventions
2. Include comprehensive TypeScript types
3. Add JSDoc documentation
4. Implement proper error handling
5. Consider performance impact
6. Test in development and staging
7. Update this documentation

---

**Note**: This observability implementation is designed for production use with comprehensive error handling, performance optimization, and minimal overhead. All metrics and traces are exported to industry-standard observability platforms.