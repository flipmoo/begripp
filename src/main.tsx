// Import polyfills and mocks first
import './polyfills'
import './mocks'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary'

// Get the root element
const rootElement = document.getElementById('root');

// Check if the root element exists
if (!rootElement) {
  console.error('Root element not found! Make sure there is a div with id "root" in your HTML.');
} else {
  // Create the root and render the app
  const root = createRoot(rootElement);

  // Render the app with the global error boundary
  root.render(
    <StrictMode>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </StrictMode>
  );
}
