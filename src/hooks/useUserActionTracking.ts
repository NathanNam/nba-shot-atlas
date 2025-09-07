import { useCallback, useEffect, useRef } from 'react';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Metrics for user action tracking
const navigationCounter = meter.createCounter('nba_navigation_events_total', {
  description: 'Total number of navigation events',
});

const sessionDurationHistogram = meter.createHistogram('nba_session_duration_seconds', {
  description: 'Duration of user sessions',
  unit: 's',
});

const userActionCounter = meter.createCounter('nba_user_actions_total', {
  description: 'Total number of user actions',
});

const pageViewDurationHistogram = meter.createHistogram('nba_page_view_duration_seconds', {
  description: 'Duration of page views',
  unit: 's',
});

export interface NavigationMetadata {
  from?: string;
  to: string;
  method: 'click' | 'browser_back' | 'browser_forward' | 'direct' | 'refresh';
  entityType?: 'player' | 'team' | 'league';
  entityName?: string;
  season?: string;
}

export interface SessionMetadata {
  sessionId: string;
  userId?: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  startTime: number;
}

export interface UserActionMetadata {
  actionType: 'click' | 'scroll' | 'search' | 'filter' | 'export' | 'share' | 'hover' | 'keyboard';
  target: string;
  component: string;
  value?: string | number;
  metadata?: Record<string, any>;
}

export function useUserActionTracking() {
  const sessionStartTime = useRef<number>(Date.now());
  const currentPageStartTime = useRef<number>(Date.now());
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Initialize session tracking
  useEffect(() => {
    const sessionMetadata: SessionMetadata = {
      sessionId: sessionId.current,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      startTime: sessionStartTime.current,
    };

    const span = tracer.startSpan('nba.session.start', {
      attributes: {
        'nba.session.id': sessionMetadata.sessionId,
        'nba.session.user_agent': sessionMetadata.userAgent,
        'nba.session.viewport.width': sessionMetadata.viewport.width,
        'nba.session.viewport.height': sessionMetadata.viewport.height,
        'nba.session.start_time': sessionMetadata.startTime,
      },
    });

    context.with(trace.setSpan(context.active(), span), () => {
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User session started',
        attributes: {
          'session_id': sessionMetadata.sessionId,
          'user_agent': sessionMetadata.userAgent,
          'viewport_width': sessionMetadata.viewport.width,
          'viewport_height': sessionMetadata.viewport.height,
          'trace_id': span.spanContext().traceId,
          'span_id': span.spanContext().spanId,
        },
      });

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    // Track session end on page unload
    const handleBeforeUnload = () => {
      const sessionDuration = (Date.now() - sessionStartTime.current) / 1000;
      
      sessionDurationHistogram.record(sessionDuration, {
        session_id: sessionId.current,
      });

      const endSpan = tracer.startSpan('nba.session.end', {
        attributes: {
          'nba.session.id': sessionId.current,
          'nba.session.duration': sessionDuration,
        },
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User session ended',
        attributes: {
          'session_id': sessionId.current,
          'duration_seconds': sessionDuration,
          'trace_id': endSpan.spanContext().traceId,
          'span_id': endSpan.spanContext().spanId,
        },
      });

      endSpan.setStatus({ code: SpanStatusCode.OK });
      endSpan.end();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // Track session end on component unmount
    };
  }, []);

  // Track navigation events
  const trackNavigation = useCallback(
    (metadata: NavigationMetadata) => {
      // Record page view duration for previous page
      const previousPageDuration = (Date.now() - currentPageStartTime.current) / 1000;
      if (previousPageDuration > 0) {
        pageViewDurationHistogram.record(previousPageDuration, {
          page: metadata.from || 'unknown',
          session_id: sessionId.current,
        });
      }

      // Reset page start time
      currentPageStartTime.current = Date.now();

      const span = tracer.startSpan('nba.navigation', {
        attributes: {
          'nba.navigation.from': metadata.from || 'unknown',
          'nba.navigation.to': metadata.to,
          'nba.navigation.method': metadata.method,
          'nba.navigation.entity_type': metadata.entityType || 'unknown',
          'nba.navigation.entity_name': metadata.entityName || 'unknown',
          'nba.navigation.season': metadata.season || 'unknown',
          'nba.session.id': sessionId.current,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        try {
          // Record navigation metrics
          navigationCounter.add(1, {
            from: metadata.from || 'unknown',
            to: metadata.to,
            method: metadata.method,
            entity_type: metadata.entityType || 'unknown',
            session_id: sessionId.current,
          });

          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `Navigation: ${metadata.from || 'unknown'} → ${metadata.to}`,
            attributes: {
              'from': metadata.from || 'unknown',
              'to': metadata.to,
              'method': metadata.method,
              'entity_type': metadata.entityType || 'unknown',
              'entity_name': metadata.entityName || 'unknown',
              'season': metadata.season || 'unknown',
              'session_id': sessionId.current,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          span.end();
        }
      });
    },
    []
  );

  // Track general user actions
  const trackUserAction = useCallback(
    (metadata: UserActionMetadata) => {
      const span = tracer.startSpan(`nba.user_action.${metadata.actionType}`, {
        attributes: {
          'nba.action.type': metadata.actionType,
          'nba.action.target': metadata.target,
          'nba.action.component': metadata.component,
          'nba.action.value': metadata.value?.toString() || 'unknown',
          'nba.session.id': sessionId.current,
          ...(metadata.metadata || {}),
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        try {
          // Record action metrics
          userActionCounter.add(1, {
            action_type: metadata.actionType,
            component: metadata.component,
            session_id: sessionId.current,
          });

          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `User action: ${metadata.actionType} on ${metadata.target}`,
            attributes: {
              'action_type': metadata.actionType,
              'target': metadata.target,
              'component': metadata.component,
              'value': metadata.value?.toString() || 'unknown',
              'session_id': sessionId.current,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
              ...(metadata.metadata || {}),
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          span.end();
        }
      });
    },
    []
  );

  // Track page/route changes
  const trackRouteChange = useCallback(
    (route: string, entityType?: string, entityName?: string, season?: string) => {
      trackNavigation({
        to: route,
        method: 'click',
        entityType: entityType as 'player' | 'team' | 'league',
        entityName,
        season,
      });
    },
    [trackNavigation]
  );

  // Track user journey milestones
  const trackMilestone = useCallback(
    (milestone: string, metadata?: Record<string, any>) => {
      const span = tracer.startSpan('nba.user_journey.milestone', {
        attributes: {
          'nba.milestone.name': milestone,
          'nba.session.id': sessionId.current,
          'nba.session.duration': (Date.now() - sessionStartTime.current) / 1000,
          ...(metadata || {}),
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: `User journey milestone: ${milestone}`,
          attributes: {
            'milestone': milestone,
            'session_id': sessionId.current,
            'session_duration': (Date.now() - sessionStartTime.current) / 1000,
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
            ...(metadata || {}),
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      });
    },
    []
  );

  // Get current session information
  const getSessionInfo = useCallback(() => {
    return {
      sessionId: sessionId.current,
      duration: (Date.now() - sessionStartTime.current) / 1000,
      startTime: sessionStartTime.current,
    };
  }, []);

  return {
    trackNavigation,
    trackUserAction,
    trackRouteChange,
    trackMilestone,
    getSessionInfo,
    sessionId: sessionId.current,
  };
}