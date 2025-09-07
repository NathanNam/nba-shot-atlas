import { useEffect } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { featureMetrics } from '../services/featureMetrics';

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
    // Use both the existing tracking and new feature metrics
    trackFeatureUsage('player_selection', {
      player_id: playerId,
      player_name: playerName,
      season: season,
    });
    
    // Enhanced tracking with custom metrics
    featureMetrics.trackPlayerSelection(playerId, playerName, season);
  };

  const trackTeamSelection = (teamId: string, teamName: string, season: string) => {
    trackFeatureUsage('team_selection', {
      team_id: teamId,
      team_name: teamName,
      season: season,
    });
    
    featureMetrics.trackTeamSelection(teamId, teamName, season);
  };

  const trackSeasonChange = (fromSeason: string, toSeason: string) => {
    trackAction('season_change', {
      from_season: fromSeason,
      to_season: toSeason,
    });
    
    featureMetrics.trackSeasonChange(fromSeason, toSeason);
  };

  const trackViewModeChange = (fromMode: string, toMode: string) => {
    trackAction('view_mode_change', {
      from_mode: fromMode,
      to_mode: toMode,
    });
    
    featureMetrics.trackViewModeChange(fromMode, toMode);
  };

  const trackShotChartInteraction = (interactionType: string, shotData?: any) => {
    trackFeatureUsage('shot_chart_interaction', {
      interaction_type: interactionType,
      shot_count: shotData?.length || 0,
    });
    
    // Enhanced tracking with entity context
    if (shotData?.entityName && shotData?.season) {
      featureMetrics.trackShotChartInteraction(
        interactionType, 
        shotData.entityName, 
        shotData.season, 
        shotData?.length || 0
      );
    }
  };

  const trackStatisticsView = (entityType: string, entityId: string, season: string) => {
    trackFeatureUsage('statistics_view', {
      entity_type: entityType,
      entity_id: entityId,
      season: season,
    });
    
    featureMetrics.trackStatisticsView(entityType, entityId, season);
  };

  const trackComparisonView = (season1: string, season2: string, entityType: string) => {
    trackFeatureUsage('comparison_view', {
      season1: season1,
      season2: season2,
      entity_type: entityType,
    });
    
    featureMetrics.trackComparisonView(season1, season2, entityType);
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
