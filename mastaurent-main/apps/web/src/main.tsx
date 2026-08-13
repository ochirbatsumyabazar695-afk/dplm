import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import { isOffline } from './lib/api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Сервер асаагүй/дахин ачаалж байвал хүлээгээд дахин оролдоно.
      // Бусад алдаа (404, 401, validation) дээр нэг л удаа.
      retry: (failureCount, error) => (isOffline(error) ? failureCount < 4 : failureCount < 1),
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: '"Helvetica Neue", Inter, Helvetica, Arial, sans-serif',
              borderRadius: '12px',
              border: '1px solid #eaeaea',
              fontSize: '14px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
