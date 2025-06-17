import React, { useState } from 'react'; // Added useState
import BinanceKeysForm from '../components/settings/BinanceKeysForm';
import OpenAIKeysForm from '../components/settings/OpenAIKeysForm';
import OpenRouterKeysForm from '../components/settings/OpenRouterKeysForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import Switch from '../components/ui/Switch';
import Alert from '../components/ui/Alert';
// const Input = (props) => <input {...props} className={`mt-1 block w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${props.className}`} />;


const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [generalSettingsFeedback, setGeneralSettingsFeedback] = useState({ message: '', type: '' });

  const { data: allSettings, isLoading: isLoadingAllSettings, error: errorAllSettings } = useQuery({
    queryKey: ['allBotSettings'],
    queryFn: settingsService.getAllBotSettings,
    select: (data) => { // Transformar el array a un objeto key-value para fácil acceso
      if (!Array.isArray(data)) return {};
      return data.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});
    }
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }) => settingsService.updateBotSetting(key, value),
    onSuccess: (data, variables) => {
      setGeneralSettingsFeedback({ message: `Setting '${variables.key}' actualizado a '${data.value}'.`, type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['allBotSettings'] });
      queryClient.invalidateQueries({ queryKey: ['apiKeysStatus'] }); // Si algún setting afecta esto
      // También invalidar queries del dashboard que dependen de settings (ej. alertas de IA)
      queryClient.invalidateQueries({ queryKey: ['allSettings'] }); // Usado en DashboardPage para alertas IA
    },
    onError: (error, variables) => {
      setGeneralSettingsFeedback({ message: error.message || `Error al actualizar '${variables.key}'.`, type: 'error' });
    },
  });

  const handleSettingChange = (key, currentValue) => {
    let newValue;
    if (typeof currentValue === 'boolean') {
      newValue = !currentValue;
    } else {
      // Para inputs de texto, el valor vendrá del evento, no implementado aquí directamente
      // Este handler es principalmente para switches booleanos
      console.warn('handleSettingChange no implementado para tipo no booleano');
      return;
    }
    setGeneralSettingsFeedback({ message: '', type: '' });
    updateSettingMutation.mutate({ key, value: newValue });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8">
      <h1 className="text-3xl font-bold text-primary mb-6">Configuración del Sistema</h1>

      <section aria-labelledby="binance-keys-heading">
        {/* <h2 id="binance-keys-heading" className="text-2xl font-semibold text-foreground mb-4">Binance</h2> */}
        <BinanceKeysForm />
      </section>

      {/* Sección para Claves de OpenAI */}
      <section aria-labelledby="openai-keys-heading" className="mt-8">
        <OpenAIKeysForm />
      </section>

      {/* Sección para Claves de OpenRouter */}
      <section aria-labelledby="openrouter-keys-heading" className="mt-8">
        <OpenRouterKeysForm />
      </section>

      {/* Sección para Configuraciones Generales del Bot (Switches, etc.) */}
      <section aria-labelledby="general-settings-heading" className="mt-8">
        <div className="p-6 bg-card border border-border rounded-lg shadow">
          <h3 id="general-settings-heading" className="text-xl font-semibold mb-4 text-foreground">Configuraciones Generales del Bot</h3>
          {isLoadingAllSettings && <p>Cargando configuraciones...</p>}
          {errorAllSettings && <Alert variant="destructive" title="Error al cargar configuraciones">{errorAllSettings.message}</Alert>}
          {allSettings && !isLoadingAllSettings && (
            <div className="space-y-6">
              <Switch
                id="paperTradingEnabled"
                label="Modo Paper Trading Activo"
                checked={allSettings.PAPER_TRADING_ENABLED === 'true'}
                onChange={() => handleSettingChange('PAPER_TRADING_ENABLED', allSettings.PAPER_TRADING_ENABLED === 'true')}
                disabled={updateSettingMutation.isPending}
              />
              <Switch
                id="openaiEnabled"
                label="OpenAI Activado"
                checked={allSettings.OPENAI_ENABLED === 'true'}
                onChange={() => handleSettingChange('OPENAI_ENABLED', allSettings.OPENAI_ENABLED === 'true')}
                disabled={updateSettingMutation.isPending}
              />
              <Switch
                id="ollamaEnabled"
                label="Ollama Activado"
                checked={allSettings.OLLAMA_ENABLED === 'true'}
                onChange={() => handleSettingChange('OLLAMA_ENABLED', allSettings.OLLAMA_ENABLED === 'true')}
                disabled={updateSettingMutation.isPending}
              />
              <Switch
                id="openrouterEnabled"
                label="OpenRouter.ai Activado"
                checked={allSettings.OPENROUTER_ENABLED === 'true'}
                onChange={() => handleSettingChange('OPENROUTER_ENABLED', allSettings.OPENROUTER_ENABLED === 'true')}
                disabled={updateSettingMutation.isPending}
              />
              {/* TODO: Añadir inputs para DEFAULT_OPENROUTER_MODEL, LOG_LEVEL etc. */}
              {/* Ejemplo para un input de texto (requiere manejar su estado localmente) */}
              {/* <div>
                <label htmlFor="logLevelSetting" className="block text-sm font-medium text-muted-foreground">Nivel de Log (LOG_LEVEL)</label>
                <Input type="text" id="logLevelSetting" defaultValue={allSettings.LOG_LEVEL || ''} onBlur={(e) => updateSettingMutation.mutate({ key: 'LOG_LEVEL', value: e.target.value })} />
              </div> */}
            </div>
          )}
          {generalSettingsFeedback.message && (
            <Alert variant={generalSettingsFeedback.type === 'success' ? 'default' : 'destructive'} title={generalSettingsFeedback.type === 'success' ? 'Éxito' : 'Error'} className="mt-4">
              {generalSettingsFeedback.message}
            </Alert>
          )}
        </div>
      </section>

    </div>
  );
};

export default SettingsPage;
