import React from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react'; // Iconos

const alertVariants = {
  default: {
    bg: 'bg-background',
    border: 'border-border',
    iconColor: 'text-foreground',
  },
  destructive: {
    bg: 'bg-destructive/10', // Un fondo más sutil para la alerta destructiva
    border: 'border-destructive',
    iconColor: 'text-destructive',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500',
    iconColor: 'text-yellow-600', // dark:text-yellow-400
  },
};

const icons = {
  destructive: <XCircle />,
  warning: <AlertTriangle />,
  default: <Info />,
};

const Alert = ({ variant = 'default', title, children, className }) => {
  const styles = alertVariants[variant] || alertVariants.default;
  const Icon = icons[variant] || icons.default;

  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border p-4 ${styles.border} ${styles.bg} ${className}`}
    >
      <div className="flex items-start">
        <span className={`mr-3 h-6 w-6 ${styles.iconColor}`}>
          {React.cloneElement(Icon, { size: 20 })}
        </span>
        <div className="flex-1">
          {title && <h5 className="mb-1 font-medium leading-none tracking-tight text-foreground">{title}</h5>}
          <div className="text-sm text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AlertTitle = ({ className, children }) => (
  <h5 className={`mb-1 font-medium leading-none tracking-tight ${className}`}>
    {children}
  </h5>
);

export const AlertDescription = ({ className, children }) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`}>
    {children}
  </div>
);


export default Alert;
