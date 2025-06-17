import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx'; // Updated extension
import { Home, Settings, ListChecks, Bot, Terminal, LogOut, UserCircle } from 'lucide-react'; // Iconos

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login'); // Redirigir a login después del logout
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Configuración', path: '/settings', icon: Settings },
    { name: 'Pares de Trading', path: '/trading-pairs', icon: ListChecks },
    { name: 'Logs del Sistema', path: '/logs', icon: Terminal },
    { name: 'Control del Bot', path: '/bot-control', icon: Bot },
  ];

  return (
    <aside className="w-64 bg-card text-card-foreground p-4 border-r border-border flex flex-col">
      <div className="text-2xl font-bold mb-2 text-primary">TradingBot UI</div>
      {user && (
        <div className="mb-4 p-2 rounded-md bg-muted">
          <div className="flex items-center">
            <UserCircle size={20} className="mr-2 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{user.username}</span>
          </div>
        </div>
      )}
      <nav className="flex-grow">
        <ul>
          {navLinks.map((link) => (
            <li key={link.name} className="mb-2">
              <Link
                to={link.path}
                className="flex items-center p-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                // TODO: Añadir activeClassName o lógica para resaltar el enlace activo
              >
                <link.icon size={18} className="mr-3" />
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        {user && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center p-2 rounded-md text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <LogOut size={18} className="mr-3" />
            Cerrar Sesión
          </button>
        )}
        <p className="mt-4 text-xs text-muted-foreground text-center">© 2023-2024 Trading Bot</p>
      </div>
    </aside>
  );
};

export default Sidebar;
