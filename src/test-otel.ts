/**
 * Simple test script to verify OpenTelemetry instrumentation is working
 * This can be run in the browser console to test the OTEL setup
 */

import { initOtel } from './otel-client';
import { NBAAnalyticsMetrics } from './services/nbaAnalyticsMetrics';
import { MetricsIntegration } from './services/metricsIntegration';

export async function testOpenTelemetrySetup() {
  console.log('🧪 Starting OpenTelemetry test...');
  
  try {
    // Initialize OpenTelemetry
    const { tracer, logger, meter } = await initOtel();
    console.log('✅ OpenTelemetry initialized successfully');
    
    // Test tracer
    const span = tracer.startSpan('test_span');
    span.setAttributes({
      'test.type': 'otel_verification',
      'test.timestamp': Date.now(),
    });
    span.end();
    console.log('✅ Tracer test completed');
    
    // Test logger
    logger.emit({
      severityNumber: 9, // INFO
      severityText: 'INFO',
      body: 'OpenTelemetry test log message',
      attributes: {
        test_type: 'otel_verification',
        timestamp: new Date().toISOString(),
      },
    });
    console.log('✅ Logger test completed');
    
    // Test metrics
    const testCounter = meter.createCounter('otel_test_counter', {
      description: 'Test counter for OTEL verification',
    });
    testCounter.add(1, { test_type: 'verification' });
    console.log('✅ Metrics test completed');
    
    // Test NBA Analytics metrics
    NBAAnalyticsMetrics.trackFeatureUsage('otel_test', { test: true });
    console.log('✅ NBA Analytics metrics test completed');
    
    // Test metrics integration
    MetricsIntegration.trackFeature('otel_verification_test', { success: true });
    console.log('✅ Metrics integration test completed');
    
    console.log('🎉 All OpenTelemetry tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ OpenTelemetry test failed:', error);
    return false;
  }
}

// Auto-run test if this module is imported
if (typeof window !== 'undefined') {
  // Add to window for manual testing
  (window as any).testOpenTelemetrySetup = testOpenTelemetrySetup;
}
