import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService'; // Para el registro
import axios from 'axios'; // Para configurar defaults de axios con el token

// Nombre de la clave para guardar el token en localStorage
const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Podría ser { id, username }
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // Para verificar el token inicial al cargar la app

  useEffect(() => {
    // Al cargar la app, intentar cargar el token/usuario desde localStorage
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        // Configurar axios para enviar el token en todas las solicitudes
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('AuthProvider: Sesión restaurada desde localStorage.');
      } catch (e) {
        console.error('AuthProvider: Error parseando usuario de localStorage', e);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    console.log('AuthProvider: Usuario logueado, token y usuario guardados.');
  };

  const handleRegister = async (username, password) => {
    // Llama al servicio de registro. No hace login automático aquí.
    // El componente LoginPage puede llamar a authService.login después si se desea.
    try {
        const data = await authService.register(username, password);
        console.log('AuthProvider: Usuario registrado:', data.user);
        return data; // Devuelve { message, user }
    } catch (error) {
        console.error('AuthProvider: Error en registro:', error);
        throw error; // Re-lanzar para que el componente lo maneje
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete axios.defaults.headers.common['Authorization'];
    console.log('AuthProvider: Usuario deslogueado, token y usuario removidos.');
    // La redirección a /login se manejará en el componente ProtectedRoute o en App.jsx
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token, // True si hay un token
    loadingAuthState: loading, // Para saber si aún se está verificando el token inicial
    login: handleLogin,       // Para ser llamado por LoginPage
    register: handleRegister, // Para ser llamado por una futura RegisterPage o LoginPage
    logout: handleLogout,     // Para ser llamado por un botón de logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) { // context puede ser null si no hay Provider
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
