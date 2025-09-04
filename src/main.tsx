import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import data preloader to start cold start optimization
import './services/dataPreloader'

createRoot(document.getElementById("root")!).render(<App />);
