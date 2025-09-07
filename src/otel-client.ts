import { Meter, metrics, trace, Tracer } from "@opentelemetry/api";
import { logs, Logger, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
  PeriodicExportingMetricReader,
  MeterProvider,
} from "@opentelemetry/sdk-metrics";
import {
  SimpleSpanProcessor,
  WebTracerProvider,
  BatchSpanProcessor,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
} from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Configuration
const serviceName = "hoops-analytics-viz"; // NBA analytics visualization app

// Default values
let otlpEndpoint = "http://localhost:4318";
let otlpEndpointBearerToken: string | undefined;
let authHeader = {};

// Sampling configuration
const getSampler = () => {
  const environment = import.meta.env.MODE;
  const samplingRate = parseFloat(import.meta.env.VITE_OTEL_SAMPLING_RATE || '1.0');
  
  // Production sampling strategy - reduce load while maintaining visibility
  if (environment === 'production') {
    // Parent-based sampling with 10% rate for root spans, but keep all child spans
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(Math.min(samplingRate, 0.1)), // Max 10% in production
    });
  }
  
  // Development and preview - sample more aggressively for debugging
  if (environment === 'development') {
    return new AlwaysOnSampler(); // Sample everything in development
  }
  
  // Default fallback - moderate sampling
  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(samplingRate),
  });
};

// Function to fetch OTEL configuration from Supabase Edge Function
async function fetchOtelConfig() {
  try {
    // Use the full Supabase URL with authentication
    const supabaseUrl = 'https://icfqngdeohzzjvzcmawo.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/get-otel-config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OTEL config: ${response.status} ${response.statusText}`);
    }

    const config = await response.json();
    
    if (config.error) {
      throw new Error(config.error);
    }

    otlpEndpoint = config.endpoint || "http://localhost:4318";
    otlpEndpointBearerToken = config.bearerToken;
    authHeader = otlpEndpointBearerToken
      ? { Authorization: `Bearer ${otlpEndpointBearerToken}` }
      : {};

    console.log(`✅ OTEL config fetched from Supabase: ${otlpEndpoint}`);
    return config;
  } catch (error) {
    console.warn("Failed to fetch OTEL config from Supabase, using defaults:", error);
    // Fallback to environment variables if available
    otlpEndpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
    otlpEndpointBearerToken = import.meta.env.VITE_OTEL_EXPORTER_OTLP_BEARER_TOKEN;
    authHeader = otlpEndpointBearerToken
      ? { Authorization: `Bearer ${otlpEndpointBearerToken}` }
      : {};
  }
}

// Create resource with additional service identification
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  'service.version': import.meta.env.VITE_APP_VERSION || '1.0.0',
  'service.instance.id': crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
  'deployment.environment': import.meta.env.MODE || 'development',
  'telemetry.sdk.name': 'opentelemetry',
  'telemetry.sdk.language': 'webjs',
  'telemetry.sdk.version': '2.1.0',
  'application.type': 'spa',
  'application.framework': 'react',
  'application.domain': 'nba-analytics',
});

// These will be initialized after fetching config
let provider: WebTracerProvider;
let loggerProvider: LoggerProvider;
let meterProvider: MeterProvider;

function createProviders() {
  // Initialize Tracer Provider with batching and sampling for performance
  provider = new WebTracerProvider({
    resource: resource,
    sampler: getSampler(),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
          headers: {
            ...authHeader,
            "x-observe-target-package": "Tracing",
            "Content-Type": "application/x-protobuf",
          },
        }),
        {
          maxQueueSize: import.meta.env.MODE === 'production' ? 200 : 100,
          maxExportBatchSize: import.meta.env.MODE === 'production' ? 20 : 10,
          scheduledDelayMillis: import.meta.env.MODE === 'production' ? 1000 : 500, // Slightly higher delay in production
          exportTimeoutMillis: 30000, // 30s timeout
        }
      ),
    ],
  });

  // Initialize Logger Provider
  loggerProvider = new LoggerProvider({
    resource: resource,
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: `${otlpEndpoint}/v1/logs`,
          headers: {
            ...authHeader,
            "x-observe-target-package": "Logs",
            "Content-Type": "application/x-protobuf",
          },
        })
      ),
    ],
  });

  // Initialize Metrics Provider with OTLP and Prometheus exporters
  const metricReaders = [];

  // Primary OTLP metrics exporter
  metricReaders.push(
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${otlpEndpoint}/v1/metrics`,
        headers: {
          ...authHeader,
          "x-observe-target-package": "Metrics",
          "Content-Type": "application/x-protobuf",
        },
      }),
      exportIntervalMillis: 10000, // Export metrics every 10 seconds
      exportTimeoutMillis: 5000,   // 5 second timeout
    })
  );

  // Add Prometheus exporter for development/debugging (optional)
  if (import.meta.env.MODE === 'development') {
    try {
      metricReaders.push(
        new PeriodicExportingMetricReader({
          exporter: new PrometheusExporter({
            port: 9464, // Default Prometheus metrics port
            preventServerStart: true, // Prevent auto-starting HTTP server in browser environment
          }),
          exportIntervalMillis: 15000, // Export to Prometheus every 15 seconds
        })
      );
    } catch (error) {
      console.warn('Failed to initialize Prometheus exporter:', error);
    }
  }

  meterProvider = new MeterProvider({
    resource: resource,
    readers: metricReaders,
  });
}

// Global instances - initialize with safe defaults
let tracer: Tracer = trace.getTracer(serviceName);
let logger: Logger;
let meter: Meter = metrics.getMeter(serviceName);

// Initialize logger with a default provider first
const defaultLoggerProvider = new LoggerProvider({ resource });
logger = defaultLoggerProvider.getLogger(serviceName);

// Initialize OpenTelemetry and return initialized components
export async function initOtel(): Promise<{ tracer: Tracer; logger: Logger; meter: Meter }> {
  // Fetch OTEL configuration from Supabase first
  await fetchOtelConfig();
  
  // Create providers with the fetched configuration
  createProviders();
  
  try {
    // Registering instrumentations / plugins
    registerInstrumentations({
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new FetchInstrumentation({
          ignoreUrls: [new RegExp(`.*${otlpEndpoint}.*`)],
          // Instrument NBA API calls and data loading
          propagateTraceHeaderCorsUrls: [
            /https:\/\/stats\.nba\.com\/.*/,
            /.*\/data\/.*/,
          ],
        }),
        new XMLHttpRequestInstrumentation({
          ignoreUrls: [new RegExp(`.*${otlpEndpoint}.*`)],
        }),
      ],
    });

    provider.register({});

    // Register the metrics provider
    metrics.setGlobalMeterProvider(meterProvider);

    // Initialize tracer, logger, and meter after SDK is started
    tracer = trace.getTracer(serviceName);
    logger = loggerProvider.getLogger(serviceName);
    meter = metrics.getMeter(serviceName);

    logs.setGlobalLoggerProvider(loggerProvider);

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: "OpenTelemetry Web SDK started for NBA Analytics Visualization",
      attributes: {
        service: serviceName,
        endpoint: otlpEndpoint,
        environment: import.meta.env.MODE,
        sampling_strategy: import.meta.env.MODE === 'production' ? 'parent_based_10pct' : 
                          import.meta.env.MODE === 'development' ? 'always_on' : 'parent_based_configurable',
        sampling_rate: import.meta.env.VITE_OTEL_SAMPLING_RATE || '1.0',
      },
    });

    return { tracer, logger, meter };
  } catch (error) {
    const fallbackLogger = loggerProvider.getLogger(serviceName);
    fallbackLogger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: "Error starting OpenTelemetry SDK",
      attributes: { error: (error as Error).message },
    });
    throw error;
  }
}

// Safe wrappers for creating metrics - these will check if meter is initialized
export const createSafeCounter = (name: string, options?: any) => {
  return {
    add: (value: number, attributes?: any) => {
      if (meter?.createCounter) {
        if (!(globalThis as any)[`__metric_${name}`]) {
          (globalThis as any)[`__metric_${name}`] = meter.createCounter(name, options);
        }
        return (globalThis as any)[`__metric_${name}`]?.add(value, attributes);
      }
    }
  };
};

export const createSafeHistogram = (name: string, options?: any) => {
  return {
    record: (value: number, attributes?: any) => {
      if (meter?.createHistogram) {
        if (!(globalThis as any)[`__metric_${name}`]) {
          (globalThis as any)[`__metric_${name}`] = meter.createHistogram(name, options);
        }
        return (globalThis as any)[`__metric_${name}`]?.record(value, attributes);
      }
    }
  };
};

export const createSafeUpDownCounter = (name: string, options?: any) => {
  return {
    add: (value: number, attributes?: any) => {
      if (meter?.createUpDownCounter) {
        if (!(globalThis as any)[`__metric_${name}`]) {
          (globalThis as any)[`__metric_${name}`] = meter.createUpDownCounter(name, options);
        }
        return (globalThis as any)[`__metric_${name}`]?.add(value, attributes);
      }
    }
  };
};

// Export global instances for use throughout the app
export { tracer, logger, meter };
