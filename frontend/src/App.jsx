import React from 'react';
import { HashRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage'; // Importar el componente real
import './index.css';

// Páginas (placeholders por ahora, se crearán en src/pages)
const DashboardPage = () => <div className="text-3xl font-semibold">Dashboard Principal</div>;
const SettingsPage = () => <div className="text-3xl font-semibold">Página de Configuración</div>;
const TradingPairsPage = () => <div className="text-3xl font-semibold">Gestión de Pares de Trading</div>;
const LogsPage = () => <div className="text-3xl font-semibold">Visor de Logs</div>;
const BotControlPage = () => <div className="text-3xl font-semibold">Control del Bot</div>;
// const LoginPage placeholder removido
const NotFoundPage = () => <div className="text-3xl font-semibold">404 - Página No Encontrada</div>;


function App() {
  // Por ahora, asumimos que el usuario está "logueado" para ver el layout.
  // La lógica de autenticación y rutas protegidas se añadirá en la Fase 2 del Frontend.
  const isAuthenticated = true;

  return (
    <Router>
      <Routes>
        {isAuthenticated ? (
          <Route path="/" element={<MainLayout><Outlet /></MainLayout>}>
            <Route index element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="trading-pairs" element={<TradingPairsPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="bot-control" element={<BotControlPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        ) : (
          <Route path="/login" element={<LoginPage />} />
          // Redirigir todo lo demás a /login si no está autenticado
          // Esto se refinará con un componente ProtectedRoute
        )}
        {/* Ruta de login si no está autenticado, o redirigir a login si intenta acceder a otra ruta */}
        { !isAuthenticated && <Route path="*" element={<LoginPage />} /> }
      </Routes>
    </Router>
  );
}

export default App;
