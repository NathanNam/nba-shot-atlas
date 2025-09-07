import { Meter, metrics, trace, Tracer } from "@opentelemetry/api";
import { logs, Logger, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
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

// Create resource
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
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
          maxQueueSize: 100,
          maxExportBatchSize: 10,
          scheduledDelayMillis: 500,
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

  // Initialize Metrics Provider with OTLP exporter
  const otlpMetricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
    headers: {
      ...authHeader,
      "x-observe-target-package": "Metrics",
      "Content-Type": "application/x-protobuf",
    },
  });

  const readers = [
    new PeriodicExportingMetricReader({
      exporter: otlpMetricExporter,
      exportIntervalMillis: 10000, // Export metrics every 10 seconds
    })
  ];

  // Note: Prometheus exporter is for server-side use only, not browser
  // Metrics are exported via OTLP only in browser environment

  meterProvider = new MeterProvider({
    resource: resource,
    readers: readers,
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

// Export global instances for use throughout the app
export { tracer, logger, meter };
