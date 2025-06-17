import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import tradingPairsService from '../services/tradingPairsService';
import { PlusCircle, Edit3, Trash2, AlertTriangle } from 'lucide-react';
// Placeholders para componentes UI (se reemplazarían con shadcn/ui)
const Button = (props) => <button {...props} className={`py-2 px-4 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background ${props.className}`} />;
const Input = (props) => <input {...props} className={`h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-ring disabled:cursor-not-allowed disabled:opacity-50 ${props.className}`} />;
const Switch = ({ id, checked, onChange, label, disabled }) => (
    <label htmlFor={id} className="flex items-center cursor-pointer my-2">
      <div className="relative">
        <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={onChange} disabled={disabled} />
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-background w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-full' : ''}`}></div>
      </div>
      {label && <span className="ml-3 text-sm font-medium text-foreground">{label}</span>}
    </label>
);
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md border border-border">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                    <Button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 !bg-transparent !border-none !shadow-none h-auto">X</Button>
                </div>
                {children}
            </div>
        </div>
    );
};


const TradingPairsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPair, setEditingPair] = useState(null); // null para nuevo, o el objeto del par para editar
  const [formState, setFormState] = useState({});
  const [formError, setFormError] = useState('');
  const [pageFeedback, setPageFeedback] = useState({ message: '', type: '' });

  const { data: tradingPairs, isLoading, error } = useQuery({
    queryKey: ['tradingPairs'],
    queryFn: () => tradingPairsService.getTradingPairs({ isActive: true }), // Mostrar activos por defecto
    // Podríamos añadir un filtro para mostrar todos/inactivos también
  });

  const { data: allTradingPairs } = useQuery({ // Para mostrar inactivos también si es necesario
    queryKey: ['allTradingPairs'],
    queryFn: () => tradingPairsService.getTradingPairs(),
  });


  const addMutation = useMutation({
    mutationFn: tradingPairsService.addTradingPair,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradingPairs'] });
      queryClient.invalidateQueries({ queryKey: ['allTradingPairs'] });
      setIsModalOpen(false);
      setEditingPair(null);
    },
    onError: (err) => setFormError(err.message || 'Error al añadir el par.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => tradingPairsService.updateTradingPair(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradingPairs'] });
      queryClient.invalidateQueries({ queryKey: ['allTradingPairs'] });
      setIsModalOpen(false);
      setEditingPair(null);
    },
    onError: (err) => setFormError(err.message || 'Error al actualizar el par.'),
  });

  const deleteMutation = useMutation({
    mutationFn: tradingPairsService.deleteTradingPair,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradingPairs'] });
      queryClient.invalidateQueries({ queryKey: ['allTradingPairs'] });
      setPageFeedback({ message: `Par ID ${pairId} eliminado exitosamente.`, type: 'success' });
    },
    onError: (err, pairId) => {
      setPageFeedback({ message: err.message || `Error al eliminar el par ID ${pairId}.`, type: 'error' });
    },
  });


  const openAddModal = () => {
    setEditingPair(null); // Asegurar que es para añadir
    setFormState({ // Valores por defecto para un nuevo par
      symbol: '', base_asset: '', quote_asset: '',
      is_active: true, margin_enabled: false,
      price_precision: 8, quantity_precision: 8,
      min_trade_size: 0.0, max_trade_size: null, tick_size: null, step_size: null,
      strategy_config: {} // Objeto vacío por defecto
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (pair) => {
    setEditingPair(pair);
    setFormState({
        ...pair,
        // Asegurar que strategy_config sea un objeto para el form, incluso si es null en DB
        strategy_config: pair.strategy_config || {}
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeletePair = (pairId) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el par ID ${pairId}?`)) {
        deleteMutation.mutate(pairId);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Para strategy_config, asumimos que es un JSON string en un textarea por ahora
    if (name === 'strategy_config_json') {
        setFormState(prev => ({ ...prev, strategy_config: value }));
    } else {
        setFormState(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setPageFeedback({ message: '', type: '' }); // Clear page feedback on new submit
    let dataToSubmit = { ...formState };

    // Validaciones adicionales
    if (!/^[A-Z0-9]+$/.test(dataToSubmit.symbol) && !editingPair) {
        setFormError('Símbolo inválido. Usar solo mayúsculas y números (ej. BTCUSDT).');
        return;
    }
    if (isNaN(parseInt(dataToSubmit.price_precision)) || parseInt(dataToSubmit.price_precision) < 0 || parseInt(dataToSubmit.price_precision) > 8) {
        setFormError('Precisión de Precio debe ser un número entre 0 y 8.');
        return;
    }
    if (isNaN(parseInt(dataToSubmit.quantity_precision)) || parseInt(dataToSubmit.quantity_precision) < 0 || parseInt(dataToSubmit.quantity_precision) > 8) {
        setFormError('Precisión de Cantidad debe ser un número entre 0 y 8.');
        return;
    }

    // Intentar parsear strategy_config si es un string JSON
    if (typeof dataToSubmit.strategy_config === 'string') {
        try {
            dataToSubmit.strategy_config = JSON.parse(dataToSubmit.strategy_config);
        } catch (jsonError) {
            setFormError('Formato JSON inválido para Strategy Config. Por favor, corrígelo o déjalo vacío.');
            return;
        }
    }


    // Convertir números de strings a números reales donde sea necesario
    dataToSubmit.price_precision = parseInt(dataToSubmit.price_precision, 10) || 8;
    dataToSubmit.quantity_precision = parseInt(dataToSubmit.quantity_precision, 10) || 8;
    dataToSubmit.min_trade_size = parseFloat(dataToSubmit.min_trade_size) || 0;
    dataToSubmit.max_trade_size = dataToSubmit.max_trade_size ? parseFloat(dataToSubmit.max_trade_size) : null;
    dataToSubmit.tick_size = dataToSubmit.tick_size ? parseFloat(dataToSubmit.tick_size) : null;
    dataToSubmit.step_size = dataToSubmit.step_size ? parseFloat(dataToSubmit.step_size) : null;


    if (editingPair) {
      // No enviar symbol, base_asset, quote_asset en la actualización
      const { symbol, base_asset, quote_asset, id, created_at, last_updated, ...updateData } = dataToSubmit;
      updateMutation.mutate({ id: editingPair.id, data: updateData });
    } else {
      addMutation.mutate(dataToSubmit);
    }
  };


  if (isLoading) return <p className="p-4">Cargando pares de trading...</p>;
  if (error) return <p className="p-4 text-destructive">Error al cargar pares: {error.message}</p>;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Feedback de la página (ej. para borrado) */}
      {pageFeedback.message && (
        <div className={`p-3 rounded-md text-sm mb-4 ${pageFeedback.type === 'success' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
          {pageFeedback.message}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Gestión de Pares de Trading</h1>
        <Button onClick={openAddModal} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <PlusCircle size={18} className="mr-2" /> Añadir Nuevo Par
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Símbolo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Activo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Margen</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Prec. Precio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Prec. Cant.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(tradingPairs || []).map(pair => (
              <tr key={pair.id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">{pair.symbol}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className={pair.is_active ? 'text-green-500' : 'text-red-500'}>
                    {pair.is_active ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{pair.margin_enabled ? 'Sí' : 'No'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{pair.price_precision}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">{pair.quantity_precision}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                  <Button onClick={() => openEditModal(pair)} className="!p-2 !bg-accent hover:!bg-accent/80 !text-accent-foreground">
                    <Edit3 size={16} />
                  </Button>
                  <Button onClick={() => handleDeletePair(pair.id)} className="!p-2 !bg-destructive hover:!bg-destructive/80 !text-destructive-foreground">
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!tradingPairs || tradingPairs.length === 0) && !isLoading && (
            <p className="p-4 text-center text-muted-foreground">No hay pares de trading activos configurados.</p>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPair ? 'Editar Par de Trading' : 'Añadir Nuevo Par'}>
        <form onSubmit={handleFormSubmit} className="space-y-4 text-sm">
          {formError && <p className="text-destructive bg-destructive/10 p-2 rounded-md">{formError}</p>}
          <div><label className="block text-muted-foreground">Símbolo (ej. BTCUSDT):</label><Input name="symbol" value={formState.symbol || ''} onChange={handleFormChange} required disabled={!!editingPair} /></div>
          <div><label className="block text-muted-foreground">Activo Base (ej. BTC):</label><Input name="base_asset" value={formState.base_asset || ''} onChange={handleFormChange} required disabled={!!editingPair} /></div>
          <div><label className="block text-muted-foreground">Activo Cotizado (ej. USDT):</label><Input name="quote_asset" value={formState.quote_asset || ''} onChange={handleFormChange} required disabled={!!editingPair} /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-muted-foreground">Precisión Precio:</label><Input type="number" name="price_precision" value={formState.price_precision || '8'} onChange={handleFormChange} /></div>
            <div><label className="block text-muted-foreground">Precisión Cantidad:</label><Input type="number" name="quantity_precision" value={formState.quantity_precision || '8'} onChange={handleFormChange} /></div>
            <div><label className="block text-muted-foreground">Tamaño Mín. Trade:</label><Input type="number" step="any" name="min_trade_size" value={formState.min_trade_size || ''} onChange={handleFormChange} /></div>
            <div><label className="block text-muted-foreground">Tamaño Máx. Trade (opc):</label><Input type="number" step="any" name="max_trade_size" value={formState.max_trade_size || ''} onChange={handleFormChange} /></div>
            <div><label className="block text-muted-foreground">Tick Size (opc):</label><Input type="number" step="any" name="tick_size" value={formState.tick_size || ''} onChange={handleFormChange} /></div>
            <div><label className="block text-muted-foreground">Step Size (opc):</label><Input type="number" step="any" name="step_size" value={formState.step_size || ''} onChange={handleFormChange} /></div>
          </div>

          <Switch id="is_active" label="Par Activo" checked={!!formState.is_active} onChange={(e) => setFormState(p=>({...p, is_active: e.target.checked}))} />
          <Switch id="margin_enabled" label="Habilitar Margen" checked={!!formState.margin_enabled} onChange={(e) => setFormState(p=>({...p, margin_enabled: e.target.checked}))} />

          <div>
            <label className="block text-muted-foreground">Configuración de Estrategia (JSON):</label>
            <textarea
                name="strategy_config_json"
                value={typeof formState.strategy_config === 'string' ? formState.strategy_config : JSON.stringify(formState.strategy_config || {}, null, 2)}
                onChange={handleFormChange}
                rows={8}
                className="mt-1 block w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder={'{
  "klinesInterval": "1h",
  "indicators": [],
  ...
}'}
            />
            <p className="text-xs text-muted-foreground mt-1">Dejar vacío o como JSON nulo (null) para usar la configuración por defecto del sistema.</p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" onClick={() => setIsModalOpen(false)} className="!bg-muted !text-muted-foreground hover:!bg-muted/80">Cancelar</Button>
            <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {editingPair ? (updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios') : (addMutation.isPending ? 'Añadiendo...' : 'Añadir Par')}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default TradingPairsPage;
