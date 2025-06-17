import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx'; // Updated extension
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';

// Crear un cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de stale time
      refetchOnWindowFocus: false, // Opcional: deshabilitar refetch en foco de ventana
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}> {/* Envolver con QueryClientProvider */}
      <AuthProvider>
        <div className="dark">
          <App />
        </div>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} /> {/* Añadir Devtools */}
    </QueryClientProvider>
  </React.StrictMode>,
)
