import './legacy';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import './utils/time';
import './styles.css';
import App from './App';
import { ApiError } from './api';
import { PrefsProvider } from './state/prefs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // Auth errors will not fix themselves by retrying.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrefsProvider>
      {/* Failure notices stack at most 3 (03 SZ-24). */}
      <AntApp notification={{ maxCount: 3 }}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </PrefsProvider>
  </React.StrictMode>,
);
