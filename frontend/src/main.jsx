// --- Polyfill para crypto.randomUUID ---
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
  console.log('[Polyfill] globalThis.crypto no existía, se ha creado un objeto vacío.');
}

if (typeof globalThis.crypto.randomUUID === 'undefined') {
  console.log('[Polyfill] crypto.randomUUID no está definido. Aplicando polyfill...');
  globalThis.crypto.randomUUID = function() {
    // Fuente: https://stackoverflow.com/a/2117523/1020991 (UUIDv4)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0,
          v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
  console.log('[Polyfill] crypto.randomUUID() ha sido polyfilled.');
} else {
  console.log('[Polyfill] crypto.randomUUID() ya está definido nativamente.');
}
// --- Fin Polyfill ---

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
