/**
 * Application entry point
 * This file initializes the React application and mounts it to the DOM
 */

// React imports
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Application imports
import App from './App.tsx';

// Styles
import './index.css';

// Find the root element in the HTML
const rootElement = document.getElementById('root');

// Ensure the root element exists
if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a div with id "root" in index.html');
}

// Create a React root and render the application
createRoot(rootElement).render(
  // StrictMode enables additional development checks and warnings
  <StrictMode>
    <App />
  </StrictMode>,
);
