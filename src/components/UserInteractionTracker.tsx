import { useEffect } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { NBAAnalyticsMetrics } from '../services/nbaAnalyticsMetrics';

// User interaction metrics
const userActionCounter = meter.createCounter('user_actions_total', {
  description: 'Total number of user actions',
});

const sessionDuration = meter.createHistogram('user_session_duration_ms', {
  description: 'Duration of user sessions',
});

const featureUsageCounter = meter.createCounter('feature_usage_total', {
  description: 'Total usage count of application features',
});

const navigationCounter = meter.createCounter('navigation_events_total', {
  description: 'Total number of navigation events',
});

interface UserInteractionTrackerProps {
  children: React.ReactNode;
}

export function UserInteractionTracker({ children }: UserInteractionTrackerProps) {
  useEffect(() => {
    const sessionStartTime = Date.now();
    const span = tracer.startSpan('user_interaction_tracker.session_start');

    try {
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User session started',
        attributes: {
          session_start_time: new Date().toISOString(),
          url: window.location.href,
          user_agent: navigator.userAgent,
          screen_resolution: `${screen.width}x${screen.height}`,
          viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        },
      });

      // Track NBA-specific user session
      NBAAnalyticsMetrics.trackUserSession(
        'new', // Could be enhanced to detect returning users
        navigator.userAgent,
        `${window.innerWidth}x${window.innerHeight}`
      );

      span.setAttributes({
        'session.start_time': sessionStartTime,
        'session.url': window.location.href,
        'session.screen_resolution': `${screen.width}x${screen.height}`,
        'session.viewport_size': `${window.innerWidth}x${window.innerHeight}`,
      });

      // Track session end
      const handleBeforeUnload = () => {
        const sessionEndSpan = tracer.startSpan('user_interaction_tracker.session_end');
        
        try {
          const sessionTime = Date.now() - sessionStartTime;
          
          sessionDuration.record(sessionTime);
          
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'User session ended',
            attributes: {
              session_duration_ms: sessionTime,
              session_end_time: new Date().toISOString(),
            },
          });

          sessionEndSpan.setAttributes({
            'session.duration_ms': sessionTime,
            'session.end_time': Date.now(),
          });
        } finally {
          sessionEndSpan.end();
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        handleBeforeUnload(); // Call on component unmount as well
      };
    } finally {
      span.end();
    }
  }, []);

  return <>{children}</>;
}

// Hook for tracking specific user actions
export function useUserActionTracking() {
  const trackAction = (actionType: string, actionData?: Record<string, any>) => {
    const span = tracer.startSpan('user_action', {
      attributes: {
        'user.action_type': actionType,
        'user.timestamp': Date.now(),
        ...actionData,
      },
    });

    try {
      userActionCounter.add(1, {
        action_type: actionType,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User action tracked',
        attributes: {
          action_type: actionType,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          ...actionData,
        },
      });

      span.setAttributes({
        'user.action_success': true,
      });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Failed to track user action',
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Failed to track user action',
        attributes: {
          action_type: actionType,
          error: (error as Error).message,
        },
      });
    } finally {
      span.end();
    }
  };

  const trackFeatureUsage = (featureName: string, featureData?: Record<string, any>) => {
    const span = tracer.startSpan('feature_usage', {
      attributes: {
        'feature.name': featureName,
        'feature.timestamp': Date.now(),
        ...featureData,
      },
    });

    try {
      featureUsageCounter.add(1, {
        feature_name: featureName,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Feature usage tracked',
        attributes: {
          feature_name: featureName,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          ...featureData,
        },
      });
    } finally {
      span.end();
    }
  };

  const trackNavigation = (fromPath: string, toPath: string, navigationData?: Record<string, any>) => {
    const span = tracer.startSpan('navigation_event', {
      attributes: {
        'navigation.from_path': fromPath,
        'navigation.to_path': toPath,
        'navigation.timestamp': Date.now(),
        ...navigationData,
      },
    });

    try {
      navigationCounter.add(1, {
        from_path: fromPath,
        to_path: toPath,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Navigation event tracked',
        attributes: {
          from_path: fromPath,
          to_path: toPath,
          timestamp: new Date().toISOString(),
          ...navigationData,
        },
      });
    } finally {
      span.end();
    }
  };

  return {
    trackAction,
    trackFeatureUsage,
    trackNavigation,
  };
}

// NBA-specific action tracking helpers
export function useNBAAnalyticsTracking() {
  const { trackAction, trackFeatureUsage } = useUserActionTracking();

  const trackPlayerSelection = (playerId: string, playerName: string, season: string) => {
    trackFeatureUsage('player_selection', {
      player_id: playerId,
      player_name: playerName,
      season: season,
    });
  };

  const trackTeamSelection = (teamId: string, teamName: string, season: string) => {
    trackFeatureUsage('team_selection', {
      team_id: teamId,
      team_name: teamName,
      season: season,
    });
  };

  const trackSeasonChange = (fromSeason: string, toSeason: string) => {
    trackAction('season_change', {
      from_season: fromSeason,
      to_season: toSeason,
    });
  };

  const trackViewModeChange = (fromMode: string, toMode: string) => {
    trackAction('view_mode_change', {
      from_mode: fromMode,
      to_mode: toMode,
    });
  };

  const trackShotChartInteraction = (interactionType: string, shotData?: any) => {
    trackFeatureUsage('shot_chart_interaction', {
      interaction_type: interactionType,
      shot_count: shotData?.length || 0,
    });

    // Enhanced NBA-specific shot chart interaction tracking
    if (shotData?.entity_name && shotData?.entity_type && shotData?.season) {
      NBAAnalyticsMetrics.trackShotChartInteraction(
        interactionType as 'hover' | 'click' | 'filter' | 'zoom' | 'export',
        {
          entityName: shotData.entity_name,
          entityType: shotData.entity_type,
          season: shotData.season,
          shotCount: shotData.shots_count || shotData.length,
          filterApplied: shotData.filter_applied,
        }
      );
    }
  };

  const trackStatisticsView = (entityType: string, entityId: string, season: string) => {
    trackFeatureUsage('statistics_view', {
      entity_type: entityType,
      entity_id: entityId,
      season: season,
    });
  };

  const trackComparisonView = (season1: string, season2: string, entityType: string, entity1?: string, entity2?: string) => {
    trackFeatureUsage('comparison_view', {
      season1: season1,
      season2: season2,
      entity_type: entityType,
    });

    // Enhanced NBA-specific comparison tracking
    if (entity1 && entity2) {
      const comparisonType = season1 !== season2 ? 'season_vs_season' : 
        (entityType === 'player' ? 'player_vs_player' : 'team_vs_team') as 'player_vs_player' | 'season_vs_season' | 'team_vs_team';
      
      NBAAnalyticsMetrics.trackComparison(
        comparisonType,
        entity1,
        entity2,
        season1,
        season2
      );
    }
  };

  return {
    trackPlayerSelection,
    trackTeamSelection,
    trackSeasonChange,
    trackViewModeChange,
    trackShotChartInteraction,
    trackStatisticsView,
    trackComparisonView,
  };
}

// Enhanced error tracking hook
export function useErrorTracking() {
  const { trackAction } = useUserActionTracking();
  
  const trackError = (error: Error, errorInfo?: any, componentContext?: Record<string, any>) => {
    const span = tracer.startSpan('error_tracking.component_error', {
      attributes: {
        'error.type': 'application_error',
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo?.componentStack || 'No component stack available',
        'error.timestamp': Date.now(),
        ...componentContext,
      },
    });

    try {
      // Gather comprehensive session context
      const sessionContext = {
        url: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
        session_storage_length: sessionStorage.length,
        local_storage_length: localStorage.length,
        document_title: document.title,
        referrer: document.referrer,
        connection: (navigator as any).connection ? {
          effective_type: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt,
        } : undefined,
      };

      // Enhanced error counter
      const errorMetrics = meter.createCounter('enhanced_error_tracking_total', {
        description: 'Enhanced error tracking with full context',
      });

      errorMetrics.add(1, {
        error_name: error.name,
        error_type: 'enhanced_component_error',
        component_context: componentContext?.component_name || 'unknown',
        url_pathname: window.location.pathname,
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Enhanced component error with full session context',
        attributes: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          component_stack: errorInfo?.componentStack,
          session_context: JSON.stringify(sessionContext),
          component_context: JSON.stringify(componentContext || {}),
          memory_usage: (performance as any).memory ? {
            used_heap_size: (performance as any).memory.usedJSHeapSize,
            total_heap_size: (performance as any).memory.totalJSHeapSize,
            heap_size_limit: (performance as any).memory.jsHeapSizeLimit,
          } : 'not_available',
        },
      });

      // Track as user action for journey mapping
      trackAction('error_occurred', {
        error_type: error.name,
        error_message: error.message.substring(0, 100), // Truncate for metrics
        component_name: componentContext?.component_name,
        route: window.location.pathname,
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Enhanced error tracking: ${error.message}`,
      });

      span.setAttributes({
        'error.session_context': JSON.stringify(sessionContext),
        'error.component_context': JSON.stringify(componentContext || {}),
        'error.enhanced_tracking': true,
      });

    } catch (trackingError) {
      console.error('Error in error tracking:', trackingError);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Failed to track error completely',
      });
    } finally {
      span.end();
    }
  };

  const trackErrorRecovery = (recoveryType: 'retry' | 'reload' | 'fallback', previousError: string) => {
    const span = tracer.startSpan('error_tracking.error_recovery', {
      attributes: {
        'recovery.type': recoveryType,
        'recovery.previous_error': previousError,
        'recovery.timestamp': Date.now(),
      },
    });

    try {
      const recoveryMetrics = meter.createCounter('error_recovery_total', {
        description: 'Error recovery attempts by type',
      });

      recoveryMetrics.add(1, {
        recovery_type: recoveryType,
        url_pathname: window.location.pathname,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Error recovery attempt initiated',
        attributes: {
          recovery_type: recoveryType,
          previous_error: previousError,
          url: window.location.href,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      });

      trackAction('error_recovery_attempt', {
        recovery_type: recoveryType,
        previous_error: previousError.substring(0, 100),
      });

    } finally {
      span.end();
    }
  };

  return {
    trackError,
    trackErrorRecovery,
  };
}
