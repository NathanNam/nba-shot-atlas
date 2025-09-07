import { useEffect, useState } from 'react';
import { trace } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Core Web Vitals metrics
const clsHistogram = meter.createHistogram('core_web_vitals_cls', {
  description: 'Cumulative Layout Shift (CLS)',
});

const fidHistogram = meter.createHistogram('core_web_vitals_fid_ms', {
  description: 'First Input Delay (FID) in milliseconds',
  unit: 'ms',
});

const lcpHistogram = meter.createHistogram('core_web_vitals_lcp_ms', {
  description: 'Largest Contentful Paint (LCP) in milliseconds',
  unit: 'ms',
});

const fcpHistogram = meter.createHistogram('core_web_vitals_fcp_ms', {
  description: 'First Contentful Paint (FCP) in milliseconds',
  unit: 'ms',
});

const ttfbHistogram = meter.createHistogram('core_web_vitals_ttfb_ms', {
  description: 'Time to First Byte (TTFB) in milliseconds',
  unit: 'ms',
});

interface WebVitalsMetrics {
  cls?: number;
  fid?: number;
  lcp?: number;
  fcp?: number;
  ttfb?: number;
}

interface WebVitalThresholds {
  cls: { good: number; needsImprovement: number };
  fid: { good: number; needsImprovement: number };
  lcp: { good: number; needsImprovement: number };
  fcp: { good: number; needsImprovement: number };
  ttfb: { good: number; needsImprovement: number };
}

const THRESHOLDS: WebVitalThresholds = {
  cls: { good: 0.1, needsImprovement: 0.25 },
  fid: { good: 100, needsImprovement: 300 },
  lcp: { good: 2500, needsImprovement: 4000 },
  fcp: { good: 1800, needsImprovement: 3000 },
  ttfb: { good: 800, needsImprovement: 1800 },
};

export function useCoreWebVitals() {
  const [metrics, setMetrics] = useState<WebVitalsMetrics>({});
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if PerformanceObserver is supported
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const span = tracer.startSpan('core_web_vitals.setup');

    try {
      // Measure CLS (Cumulative Layout Shift)
      const measureCLS = () => {
        try {
          const clsObserver = new PerformanceObserver((list) => {
            let clsValue = 0;
            
            list.getEntries().forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });

            if (clsValue > 0) {
              const rating = clsValue <= THRESHOLDS.cls.good ? 'good' : 
                           clsValue <= THRESHOLDS.cls.needsImprovement ? 'needs-improvement' : 'poor';

              clsHistogram.record(clsValue, {
                rating,
                page_url: window.location.pathname,
              });

              logger.emit({
                severityNumber: rating === 'poor' ? SeverityNumber.WARN : SeverityNumber.INFO,
                severityText: rating === 'poor' ? 'WARN' : 'INFO',
                body: 'Cumulative Layout Shift measured',
                attributes: {
                  cls_value: clsValue,
                  cls_rating: rating,
                  url: window.location.href,
                },
              });

              setMetrics(prev => ({ ...prev, cls: clsValue }));
            }
          });

          clsObserver.observe({ entryTypes: ['layout-shift'] });
          return clsObserver;
        } catch (error) {
          console.warn('Failed to observe CLS:', error);
          return null;
        }
      };

      // Measure FID (First Input Delay)
      const measureFID = () => {
        try {
          const fidObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
              const fidValue = entry.processingStart - entry.startTime;
              const rating = fidValue <= THRESHOLDS.fid.good ? 'good' : 
                           fidValue <= THRESHOLDS.fid.needsImprovement ? 'needs-improvement' : 'poor';

              fidHistogram.record(fidValue, {
                rating,
                page_url: window.location.pathname,
              });

              logger.emit({
                severityNumber: rating === 'poor' ? SeverityNumber.WARN : SeverityNumber.INFO,
                severityText: rating === 'poor' ? 'WARN' : 'INFO',
                body: 'First Input Delay measured',
                attributes: {
                  fid_value: fidValue,
                  fid_rating: rating,
                  input_type: entry.name,
                  url: window.location.href,
                },
              });

              setMetrics(prev => ({ ...prev, fid: fidValue }));
            });
          });

          fidObserver.observe({ entryTypes: ['first-input'] });
          return fidObserver;
        } catch (error) {
          console.warn('Failed to observe FID:', error);
          return null;
        }
      };

      // Measure LCP (Largest Contentful Paint)
      const measureLCP = () => {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            
            if (lastEntry) {
              const lcpValue = lastEntry.startTime;
              const rating = lcpValue <= THRESHOLDS.lcp.good ? 'good' : 
                           lcpValue <= THRESHOLDS.lcp.needsImprovement ? 'needs-improvement' : 'poor';

              lcpHistogram.record(lcpValue, {
                rating,
                page_url: window.location.pathname,
                element_type: lastEntry.element?.tagName?.toLowerCase() || 'unknown',
              });

              logger.emit({
                severityNumber: rating === 'poor' ? SeverityNumber.WARN : SeverityNumber.INFO,
                severityText: rating === 'poor' ? 'WARN' : 'INFO',
                body: 'Largest Contentful Paint measured',
                attributes: {
                  lcp_value: lcpValue,
                  lcp_rating: rating,
                  element_type: lastEntry.element?.tagName?.toLowerCase() || 'unknown',
                  url: window.location.href,
                },
              });

              setMetrics(prev => ({ ...prev, lcp: lcpValue }));
            }
          });

          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          return lcpObserver;
        } catch (error) {
          console.warn('Failed to observe LCP:', error);
          return null;
        }
      };

      // Measure FCP and TTFB from Navigation Timing
      const measureNavigationMetrics = () => {
        try {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          
          if (navigation) {
            // TTFB (Time to First Byte)
            const ttfbValue = navigation.responseStart - navigation.fetchStart;
            if (ttfbValue > 0) {
              const ttfbRating = ttfbValue <= THRESHOLDS.ttfb.good ? 'good' : 
                               ttfbValue <= THRESHOLDS.ttfb.needsImprovement ? 'needs-improvement' : 'poor';

              ttfbHistogram.record(ttfbValue, {
                rating: ttfbRating,
                page_url: window.location.pathname,
              });

              setMetrics(prev => ({ ...prev, ttfb: ttfbValue }));
            }
          }

          // FCP (First Contentful Paint)
          const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
          if (fcpEntry) {
            const fcpValue = fcpEntry.startTime;
            const fcpRating = fcpValue <= THRESHOLDS.fcp.good ? 'good' : 
                             fcpValue <= THRESHOLDS.fcp.needsImprovement ? 'needs-improvement' : 'poor';

            fcpHistogram.record(fcpValue, {
              rating: fcpRating,
              page_url: window.location.pathname,
            });

            logger.emit({
              severityNumber: fcpRating === 'poor' ? SeverityNumber.WARN : SeverityNumber.INFO,
              severityText: fcpRating === 'poor' ? 'WARN' : 'INFO',
              body: 'First Contentful Paint measured',
              attributes: {
                fcp_value: fcpValue,
                fcp_rating: fcpRating,
                url: window.location.href,
              },
            });

            setMetrics(prev => ({ ...prev, fcp: fcpValue }));
          }
        } catch (error) {
          console.warn('Failed to measure navigation metrics:', error);
        }
      };

      // Initialize observers
      const clsObserver = measureCLS();
      const fidObserver = measureFID();
      const lcpObserver = measureLCP();

      // Measure navigation metrics after a brief delay to ensure they're available
      setTimeout(measureNavigationMetrics, 100);

      span.setAttributes({
        'webvitals.setup_complete': true,
        'webvitals.observers_count': [clsObserver, fidObserver, lcpObserver].filter(Boolean).length,
      });

      // Cleanup function
      return () => {
        try {
          clsObserver?.disconnect();
          fidObserver?.disconnect();
          lcpObserver?.disconnect();
        } catch (error) {
          console.warn('Error disconnecting observers:', error);
        }
      };
    } finally {
      span.end();
    }
  }, []);

  const getMetricRating = (metricName: keyof WebVitalThresholds, value: number): string => {
    const thresholds = THRESHOLDS[metricName];
    return value <= thresholds.good ? 'good' : 
           value <= thresholds.needsImprovement ? 'needs-improvement' : 'poor';
  };

  const getOverallScore = (): 'good' | 'needs-improvement' | 'poor' => {
    const scores = Object.entries(metrics).map(([key, value]) => {
      if (value === undefined) return null;
      return getMetricRating(key as keyof WebVitalThresholds, value);
    }).filter(Boolean);

    if (scores.length === 0) return 'good';

    const poorCount = scores.filter(s => s === 'poor').length;
    const needsImprovementCount = scores.filter(s => s === 'needs-improvement').length;

    if (poorCount > 0) return 'poor';
    if (needsImprovementCount > 0) return 'needs-improvement';
    return 'good';
  };

  return {
    metrics,
    isSupported,
    getMetricRating,
    getOverallScore,
    thresholds: THRESHOLDS,
  };
}