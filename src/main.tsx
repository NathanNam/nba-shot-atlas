// CRITICAL: Initialize OpenTelemetry FIRST before any other imports
import { initOtel } from './otel-client'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import data preloader to start cold start optimization
import './services/dataPreloader'

// Initialize OpenTelemetry asynchronously
initOtel().then(() => {
  console.log("OpenTelemetry initialized successfully with Supabase config");
}).catch(error => {
  console.error("Failed to initialize OpenTelemetry:", error);
});

createRoot(document.getElementById("root")!).render(<App />);
