import React from 'react';
// import { Link } from 'react-router-dom'; // Se añadirá cuando haya rutas
// import { Home, Settings, BarChart2, ListChecks, Bot, Terminal } from 'lucide-react'; // Iconos de ejemplo

const Sidebar = () => {
  // Enlaces de navegación (placeholders)
  const navLinks = [
    { name: 'Dashboard', path: '/', icon: 'HomeIcon' },
    { name: 'Configuración', path: '/settings', icon: 'SettingsIcon' },
    { name: 'Pares de Trading', path: '/trading-pairs', icon: 'ListChecksIcon' },
    { name: 'Logs del Sistema', path: '/logs', icon: 'TerminalIcon' },
    { name: 'Control del Bot', path: '/bot-control', icon: 'BotIcon' },
  ];

  return (
    <aside className="w-64 bg-card text-card-foreground p-4 border-r border-border flex flex-col">
      <div className="text-2xl font-bold mb-6 text-primary">TradingBot UI</div>
      <nav className="flex-grow">
        <ul>
          {navLinks.map((link) => (
            <li key={link.name} className="mb-3">
              <a
                href={link.path}
                onClick={(e) => { e.preventDefault(); alert(`Navegar a: ${link.path} (pendiente react-router-dom Link)`) }}
                className="flex items-center p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {/* Placeholder para icono real */}
                {/* <link.icon className="w-5 h-5 mr-3" /> */}
                <span className="mr-3">Icon</span> {/* Reemplazar con icono real */}
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        <p className="text-xs text-muted-foreground">© 2023 Trading Bot</p>
      </div>
    </aside>
  );
};

export default Sidebar;
