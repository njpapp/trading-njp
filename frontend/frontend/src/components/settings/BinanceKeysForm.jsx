import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../../services/settingsService';
// Suponiendo que tenemos componentes Button y Input de shadcn/ui o placeholders
// Para este subtask, usaré inputs y button HTML básicos estilizados con Tailwind.
// import { Button } from "@/components/ui/button"; // Ejemplo shadcn
// import { Input } from "@/components/ui/input"; // Ejemplo shadcn
// import { Eye, EyeOff } from 'lucide-react';

// Placeholder simple para Input y Button si shadcn no está completamente integrado
const Input = (props) => <input {...props} className={`mt-1 block w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${props.className}`} />;
const Button = (props) => <button {...props} className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 ${props.className}`}>{props.children}</button>;


const BinanceKeysForm = () => {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' }); // type: 'success' o 'error'

  const { data: apiKeysStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['apiKeysStatus'],
    queryFn: settingsService.getApiKeysStatus,
  });

  const mutation = useMutation({
    mutationFn: (keys) => settingsService.saveApiKeys('binance', keys),
    onSuccess: (data) => {
      setFeedback({ message: data.message || 'Claves de Binance guardadas exitosamente.', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['apiKeysStatus'] }); // Refrescar el estado de las claves
      setApiKey(''); // Limpiar campos después de guardar
      setSecretKey('');
    },
    onError: (error) => {
      setFeedback({ message: error.message || 'Error al guardar claves de Binance.', type: 'error' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' }); // Limpiar feedback anterior
    if (!apiKey || !secretKey) {
      setFeedback({ message: 'API Key y Secret Key son requeridas.', type: 'error' });
      return;
    }
    mutation.mutate({ apiKey, secretKey });
  };

  const binanceKeysConfigured = apiKeysStatus?.binance?.configured;

  return (
    <div className="p-6 bg-card border border-border rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-1 text-foreground">Claves API de Binance</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {isLoadingStatus ? 'Verificando estado...' :
         binanceKeysConfigured ? 'Las claves de Binance están configuradas.' : 'Las claves de Binance NO están configuradas.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="binanceApiKey" className="block text-sm font-medium text-muted-foreground">API Key</label>
          <Input
            id="binanceApiKey"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={binanceKeysConfigured ? "•••••••••••••••••••• (Configurada)" : "Tu API Key de Binance"}
            required
          />
        </div>
        <div>
          <label htmlFor="binanceSecretKey" className="block text-sm font-medium text-muted-foreground">Secret Key</label>
          <div className="relative">
            <Input
              id="binanceSecretKey"
              type={showSecret ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={binanceKeysConfigured ? "•••••••••••••••••••• (Configurada)" : "Tu Secret Key de Binance"}
              required
            />
            {/* Icono para mostrar/ocultar contraseña (placeholder) */}
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-sm text-muted-foreground hover:text-foreground"
              aria-label={showSecret ? "Ocultar Secret Key" : "Mostrar Secret Key"}
            >
              {showSecret ? 'Ocultar' : 'Mostrar'}
              {/* {showSecret ? <EyeOff size={18} /> : <Eye size={18} />} */}
            </button>
          </div>
        </div>

        {feedback.message && (
          <p className={`text-sm ${feedback.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
            {feedback.message}
          </p>
        )}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar Claves de Binance'}
        </Button>
      </form>
       <p className="mt-4 text-xs text-muted-foreground">
        Las claves se envían de forma segura a tu backend y se almacenan encriptadas. El frontend nunca las almacena directamente.
        Un reinicio del bot puede ser necesario para que las nuevas claves tomen efecto.
      </p>
    </div>
  );
};

export default BinanceKeysForm;
