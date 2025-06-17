import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = () => {
  const { isAuthenticated, loadingAuthState } = useAuth();
  const location = useLocation();

  if (loadingAuthState) {
    // Podrías mostrar un spinner de carga global aquí o un layout mínimo
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        Cargando autenticación...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirigir a login, guardando la ubicación actual para redirigir de vuelta después del login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />; // Renderiza el contenido de la ruta hija si está autenticado
};

export default ProtectedRoute;
