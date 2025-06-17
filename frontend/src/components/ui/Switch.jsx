import React from 'react';

// Este es un Switch muy básico usando un checkbox estilizado.
// Para una mejor UX y accesibilidad, se recomienda el componente Switch de shadcn/ui
// o una librería de componentes UI similar.
const Switch = ({ id, checked, onChange, label, disabled }) => {
  return (
    <label htmlFor={id} className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only" // Ocultar el checkbox por defecto
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        {/* Base del switch */}
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}></div>
        {/* Círculo del switch */}
        <div
          className={`dot absolute left-1 top-1 bg-background w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-full' : ''}`}
        ></div>
      </div>
      {label && <span className="ml-3 text-sm font-medium text-foreground">{label}</span>}
    </label>
  );
};

export default Switch;
