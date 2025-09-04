// CRITICAL: Initialize OpenTelemetry FIRST before any other imports
import { initOtel } from './otel-client'

// Initialize OpenTelemetry
const { tracer, logger, meter } = initOtel()

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import data preloader to start cold start optimization
import './services/dataPreloader'

createRoot(document.getElementById("root")!).render(<App />);
