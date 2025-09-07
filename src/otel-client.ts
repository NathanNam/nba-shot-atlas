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

// Enhanced sampling configuration with performance considerations
const getSampler = () => {
  const environment = import.meta.env.MODE;
  const userSamplingRate = parseFloat(import.meta.env.VITE_OTEL_SAMPLING_RATE || '0');
  const enableTelemetry = import.meta.env.VITE_ENABLE_TELEMETRY === 'true';
  const otelConfig = (window as any).__OTEL_CONFIG__;
  
  // Check for instrumentation toggle from main.tsx
  if (otelConfig && !otelConfig.enableInstrumentation) {
    console.log('🔧 OpenTelemetry instrumentation disabled by configuration');
    return new AlwaysOffSampler();
  }
  
  // Production sampling strategy - optimized for performance and cost
  if (environment === 'production') {
    const productionRate = userSamplingRate > 0 ? Math.min(userSamplingRate, 0.1) : 0.05; // Max 10%, default 5%
    
    // Use parent-based sampling to maintain trace integrity
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(productionRate),
      // Keep child spans when parent is sampled to maintain complete traces
      remoteParentSampled: new AlwaysOnSampler(),
      remoteParentNotSampled: new AlwaysOffSampler(),
      localParentSampled: new AlwaysOnSampler(),
      localParentNotSampled: new AlwaysOffSampler(),
    });
  }
  
  // Development - high sampling for debugging but with performance control
  if (environment === 'development') {
    // Allow override for development debugging
    if (enableTelemetry || userSamplingRate > 0) {
      const devRate = userSamplingRate > 0 ? userSamplingRate : 1.0;
      return new TraceIdRatioBasedSampler(devRate);
    }
    // Default to moderate sampling in development to avoid performance issues
    return new TraceIdRatioBasedSampler(0.3);
  }
  
  // Preview/staging - balanced approach
  if (environment === 'preview' || environment === 'staging') {
    const previewRate = userSamplingRate > 0 ? Math.min(userSamplingRate, 0.5) : 0.2;
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(previewRate),
    });
  }
  
  // Default fallback - conservative sampling
  const fallbackRate = userSamplingRate > 0 ? Math.min(userSamplingRate, 0.1) : 0.1;
  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(fallbackRate),
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
  const environment = import.meta.env.MODE;
  const otelConfig = (window as any).__OTEL_CONFIG__;
  
  // Environment-aware batch processing configuration
  const getBatchConfig = () => {
    if (environment === 'production') {
      return {
        // Production: Optimize for efficiency and reduced resource usage
        maxQueueSize: 200,
        maxExportBatchSize: 50,
        scheduledDelayMillis: 2000, // Wait longer to collect more spans
        exportTimeoutMillis: 30000,
      };
    } else if (environment === 'development') {
      return {
        // Development: Faster feedback for debugging
        maxQueueSize: 50,
        maxExportBatchSize: 10,
        scheduledDelayMillis: 500,
        exportTimeoutMillis: 10000,
      };
    } else {
      return {
        // Default/staging: Balanced approach
        maxQueueSize: 100,
        maxExportBatchSize: 25,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 20000,
      };
    }
  };

  const getMetricsConfig = () => {
    if (environment === 'production') {
      return {
        exportIntervalMillis: 60000, // 1 minute in production
      };
    } else if (environment === 'development') {
      return {
        exportIntervalMillis: 5000, // 5 seconds in development for quick feedback
      };
    } else {
      return {
        exportIntervalMillis: 15000, // 15 seconds for staging/preview
      };
    }
  };

  const batchConfig = getBatchConfig();
  const metricsConfig = getMetricsConfig();

  // Create span processor based on environment and configuration
  const createSpanProcessor = () => {
    const traceExporter = new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
      headers: {
        ...authHeader,
        "x-observe-target-package": "Tracing",
        "Content-Type": "application/x-protobuf",
        "x-environment": environment,
        "x-nba-analytics-version": "1.0.0",
      },
    });

    // Use batch processing for efficiency, unless disabled
    if (otelConfig?.enableBatchProcessing !== false) {
      return new BatchSpanProcessor(traceExporter, batchConfig);
    } else {
      // Fallback to simple processor (immediate export) - not recommended for production
      return new SimpleSpanProcessor(traceExporter);
    }
  };

  // Initialize Tracer Provider with enhanced configuration
  provider = new WebTracerProvider({
    resource: resource,
    sampler: getSampler(),
    spanProcessors: [createSpanProcessor()],
  });

  // Initialize Logger Provider with environment-aware configuration
  const createLogProcessor = () => {
    const logExporter = new OTLPLogExporter({
      url: `${otlpEndpoint}/v1/logs`,
      headers: {
        ...authHeader,
        "x-observe-target-package": "Logs",
        "Content-Type": "application/x-protobuf",
        "x-environment": environment,
        "x-nba-analytics-version": "1.0.0",
      },
    });

    // Use batch processing with environment-specific configuration
    return new BatchLogRecordProcessor(logExporter, {
      maxQueueSize: batchConfig.maxQueueSize,
      maxExportBatchSize: batchConfig.maxExportBatchSize,
      scheduledDelayMillis: batchConfig.scheduledDelayMillis,
      exportTimeoutMillis: batchConfig.exportTimeoutMillis,
    });
  };

  loggerProvider = new LoggerProvider({
    resource: resource,
    processors: [createLogProcessor()],
  });

  // Initialize Metrics Provider with enhanced environment-aware configuration
  const createMetricExporter = () => {
    return new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
      headers: {
        ...authHeader,
        "x-observe-target-package": "Metrics",
        "Content-Type": "application/x-protobuf",
        "x-environment": environment,
        "x-nba-analytics-version": "1.0.0",
      },
    });
  };

  const readers = [
    new PeriodicExportingMetricReader({
      exporter: createMetricExporter(),
      exportIntervalMillis: metricsConfig.exportIntervalMillis,
      exportTimeoutMillis: batchConfig.exportTimeoutMillis,
    })
  ];

  // Note: Prometheus exporter is for server-side use only, not browser
  // Metrics are exported via OTLP only in browser environment

  meterProvider = new MeterProvider({
    resource: resource,
    readers: readers,
  });

  // Log configuration summary
  console.log('🔧 OpenTelemetry providers configured:', {
    environment,
    sampling: {
      enabled: !(getSampler() instanceof AlwaysOffSampler),
      type: getSampler().constructor.name,
    },
    batching: {
      enabled: otelConfig?.enableBatchProcessing !== false,
      traces: batchConfig,
      metrics: metricsConfig,
    },
    instrumentation: {
      enabled: otelConfig?.enableInstrumentation !== false,
    },
    endpoint: otlpEndpoint,
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
