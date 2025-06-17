import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../../services/settingsService';

// Placeholder simple para Input y Button
const Input = (props) => <input {...props} className={`mt-1 block w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${props.className}`} />;
const Button = (props) => <button {...props} className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 ${props.className}`}>{props.children}</button>;

const OpenRouterKeysForm = () => {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const { data: apiKeysStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['apiKeysStatus'],
    queryFn: settingsService.getApiKeysStatus,
  });

  const mutation = useMutation({
    mutationFn: (keys) => settingsService.saveApiKeys('openrouter', keys),
    onSuccess: (data) => {
      setFeedback({ message: data.message || 'Clave de OpenRouter guardada exitosamente.', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['apiKeysStatus'] });
      setApiKey('');
    },
    onError: (error) => {
      setFeedback({ message: error.message || 'Error al guardar clave de OpenRouter.', type: 'error' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' });
    if (!apiKey) {
      setFeedback({ message: 'API Key es requerida.', type: 'error' });
      return;
    }
    mutation.mutate({ apiKey });
  };

  const openRouterKeyConfigured = apiKeysStatus?.openrouter?.configured;

  return (
    <div className="p-6 bg-card border border-border rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-1 text-foreground">Clave API de OpenRouter.ai</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {isLoadingStatus ? 'Verificando estado...' :
         openRouterKeyConfigured ? 'La clave de OpenRouter está configurada.' : 'La clave de OpenRouter NO está configurada.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="openRouterApiKey" className="block text-sm font-medium text-muted-foreground">API Key</label>
          <div className="relative">
            <Input
              id="openRouterApiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={openRouterKeyConfigured ? "•••••••••••••••••••• (Configurada)" : "sk-or-..."}
              required
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-sm text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Ocultar API Key" : "Mostrar API Key"}
            >
              {showKey ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {feedback.message && (
          <p className={`text-sm ${feedback.type === 'success' ? 'text-green-500' : 'text-destructive'}`}>
            {feedback.message}
          </p>
        )}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar Clave de OpenRouter'}
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        La clave se envía de forma segura a tu backend y se almacena encriptada.
        Un reinicio del bot puede ser necesario para que la nueva clave tome efecto.
      </p>
    </div>
  );
};

export default OpenRouterKeysForm;
