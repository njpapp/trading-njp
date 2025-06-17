import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom'; // Se usará después del login exitoso
// import authService from '../services/authService'; // Se usará para llamar al API
// import { useAuth } from '../contexts/AuthContext'; // Se usará para setear el usuario/token

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // const navigate = useNavigate();
  // const { login: contextLogin } = useAuth(); // Asumiendo que el AuthContext tiene una función login

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    alert(`Intento de login con Usuario: ${username}, Contraseña: ${password} (lógica de API pendiente)`);
    // try {
    //   // const response = await authService.login(username, password);
    //   // logger.debug('Login response:', response); // Asumiendo un logger frontend
    //   // contextLogin(response.token, response.user); // Guardar token y datos de usuario en AuthContext
    //   // navigate('/'); // Redirigir al dashboard
    // } catch (err) {
    //   const errorMessage = err.response?.data?.message || err.message || 'Error al iniciar sesión.';
    //   setError(errorMessage);
    //   console.error('Login error:', errorMessage);
    // } finally {
    //   setLoading(false);
    // }
    setLoading(false); // Quitar cuando la lógica real esté
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card shadow-xl rounded-lg">
        <h1 className="text-3xl font-bold text-center text-primary">Iniciar Sesión</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-muted-foreground">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="tu_usuario"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="tu_contraseña"
            />
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
