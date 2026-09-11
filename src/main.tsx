import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { MarketDataProvider } from './market/MarketDataContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MarketDataProvider>
        <App />
      </MarketDataProvider>
    </ErrorBoundary>
  </StrictMode>,
);
