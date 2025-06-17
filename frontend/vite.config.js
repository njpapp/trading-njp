import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // Importar path para resolver alias si se usa @

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { // Configuración de alias (ej. para @/components)
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173, // Puerto por defecto de Vite, se puede cambiar si es necesario
    proxy: {
      // Proxy /api/v1 a tu backend en http://192.168.101.11:3770
      '/api/v1': {
        target: 'http://192.168.101.11:3770',
        changeOrigin: true, // Necesario para hosts virtuales o si el backend está en otra IP/dominio
        secure: false,      // Poner a true si el backend usa HTTPS (incluso con cert autofirmado si se configura bien el agente)
        // Opcional: reescribir la ruta si es necesario (no en este caso ya que la base /api/v1 es la misma)
        // rewrite: (path) => path.replace(/^\/api\/v1/, '/api/v1'),

        // Opcional: Loguear las solicitudes proxied para depuración
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Error de proxy:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Enviando solicitud a Target:', req.method, req.url, '->', proxyReq.protocol + '//' + proxyReq.host + proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Respuesta recibida del Target:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  }
})
