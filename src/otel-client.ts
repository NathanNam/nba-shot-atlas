import { Meter, metrics, trace, Tracer } from "@opentelemetry/api";
import { logs, Logger, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
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
  SimpleSpanProcessor,
  WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Configuration
const serviceName = "hoops-analytics-viz"; // NBA analytics visualization app

// Vite environment variables
const otlpEndpoint =
  import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ?? 
  import.meta.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 
  "http://localhost:4318";
const otlpEndpointBearerToken = 
  import.meta.env.VITE_OTEL_EXPORTER_OTLP_BEARER_TOKEN ??
  import.meta.env.OTEL_EXPORTER_OTLP_BEARER_TOKEN;

const authHeader = otlpEndpointBearerToken
  ? { Authorization: `Bearer ${otlpEndpointBearerToken}` }
  : {};

// Create resource
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
});

const provider = new WebTracerProvider({
  resource: resource,
  spanProcessors: [
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
        headers: {
          ...authHeader,
          "x-observe-target-package": "Tracing",
        },
      })
    ),
  ],
});

// Initialize Logger Provider
const loggerProvider = new LoggerProvider({
  resource: resource,
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${otlpEndpoint}/v1/logs`,
        headers: {
          ...authHeader,
          "x-observe-target-package": "Logs",
        },
      })
    ),
  ],
});

// Global instances
let tracer: Tracer;
let logger: Logger;
let meter: Meter;

// Initialize OpenTelemetry and return initialized components
export function initOtel(): { tracer: Tracer; logger: Logger; meter: Meter } {
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
