import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, getInitialTheme } from './shared/theme';

function normalizeApiBaseUrl(value: string) {
  return value.replace(/\/+$/, '').replace(/\/v1$/, '');
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');

applyTheme(getInitialTheme());

if (typeof window !== 'undefined' && apiBaseUrl) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/v1/')) {
      return originalFetch(`${apiBaseUrl}${input}`, init);
    }

    if (input instanceof Request) {
      const requestUrl = new URL(input.url, window.location.origin);
      if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/v1/')) {
        const rewrittenUrl = `${apiBaseUrl}${requestUrl.pathname}${requestUrl.search}`;
        return originalFetch(new Request(rewrittenUrl, input), init);
      }
    }

    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
