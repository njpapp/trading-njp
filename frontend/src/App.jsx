import React from 'react';
import { HashRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './contexts/AuthContext'; // Importar useAuth
import './index.css';

// Páginas (placeholders por ahora, se crearán en src/pages)
const DashboardPage = () => <div className="text-3xl font-semibold">Dashboard Principal</div>;
const SettingsPage = () => <div className="text-3xl font-semibold">Página de Configuración</div>;
const TradingPairsPage = () => <div className="text-3xl font-semibold">Gestión de Pares de Trading</div>;
const LogsPage = () => <div className="text-3xl font-semibold">Visor de Logs</div>;
const BotControlPage = () => <div className="text-3xl font-semibold">Control del Bot</div>;
const NotFoundPage = () => <div className="text-3xl font-semibold">404 - Página No Encontrada</div>;

function AppRoutes() {
  const { isAuthenticated, loadingAuthState } = useAuth();

  if (loadingAuthState) {
    // Muestra un loader mientras se verifica el estado de autenticación inicial
    // Esto evita un parpadeo de la página de login si el usuario ya está logueado
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        Verificando sesión...
      </div>
    );
  }

  return (
    <Routes>
      {/* Ruta de Login: si está autenticado, redirige al dashboard, sino muestra LoginPage */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Rutas Protegidas */}
      <Route element={<ProtectedRoute />}> {/* Envuelve las rutas que necesitan autenticación */}
        <Route path="/" element={<MainLayout><Outlet /></MainLayout>}>
          <Route index element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="trading-pairs" element={<TradingPairsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="bot-control" element={<BotControlPage />} />
          {/* Más rutas protegidas aquí */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      {/* Fallback si ninguna ruta coincide y no está autenticado (debería ser manejado por ProtectedRoute o la lógica de /login) */}
      {/* Si no está autenticado y no es /login, ProtectedRoute lo mandará a /login */}
      {/* Si está autenticado y la ruta no existe, el '*' dentro de ProtectedRoute lo manejará */}
    </Routes>
  );
}

function App() {
  // AuthProvider ya está en main.jsx
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
