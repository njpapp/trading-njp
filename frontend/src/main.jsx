import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext'; // Importar AuthProvider
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider> {/* Envolver App con AuthProvider */}
      <div className="dark"> {/* Mantener tema oscuro por defecto */}
        <App />
      </div>
    </AuthProvider>
  </React.StrictMode>,
)
