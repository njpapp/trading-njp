import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import logService from '../services/logService';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'; // Placeholder Tabs

// Placeholder para la tabla y paginación (se refinará en Paso 25)
const DataTable = ({ data, columns, isLoading, error }) => {
  if (isLoading) return <p>Cargando datos...</p>;
  if (error) return <p className="text-destructive">Error: {error.message}</p>;
  if (!data || data.length === 0) return <p className="text-muted-foreground">No hay datos para mostrar.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            {columns.map(col => (
              <th key={col.accessorKey} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {data.map((row, rowIndex) => (
            <tr key={row.id || rowIndex}>
              {columns.map(col => (
                <td key={col.accessorKey} className="px-4 py-2 whitespace-nowrap text-sm">
                  {/* Simple accessor, se puede mejorar con col.cell */}
                  {col.accessorKey.includes('.')
                    ? col.accessorKey.split('.').reduce((obj, key) => obj && obj[key], row)
                    : row[col.accessorKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const transactionColumns = [
  { accessorKey: 'created_at', header: 'Fecha Creación' },
  { accessorKey: 'pair_symbol', header: 'Par' },
  { accessorKey: 'type', header: 'Tipo' },
  { accessorKey: 'mode', header: 'Modo' },
  { accessorKey: 'price', header: 'Precio' },
  { accessorKey: 'quantity', header: 'Cantidad' },
  { accessorKey: 'status', header: 'Estado' },
  { accessorKey: 'is_paper_trade', header: 'Paper' },
];

const aiDecisionColumns = [
  { accessorKey: 'timestamp', header: 'Fecha' },
  { accessorKey: 'pair_symbol', header: 'Par' },
  { accessorKey: 'decision', header: 'Decisión' },
  { accessorKey: 'reason', header: 'Razón (truncada)' }, // Se truncará en el render o se expandirá
  { accessorKey: 'ai_model_used', header: 'Modelo IA' },
];

const systemLogColumns = [
  { accessorKey: 'timestamp', header: 'Fecha' },
  { accessorKey: 'level', header: 'Nivel' },
  { accessorKey: 'message', header: 'Mensaje (truncado)' }, // Se truncará
];


const LogsPage = () => {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions', 'aidecisions', 'systemlogs'
  // TODO: Añadir estado para filtros y paginación en Paso 25

  // Query genérica que se actualiza cuando cambia activeTab o los filtros/página
  const { data: logData, isLoading, error, isFetching } = useQuery({
    queryKey: ['logs', activeTab /*, page, filters... */], // Incluir page y filters cuando se implementen
    queryFn: () => logService.getLogs(activeTab, { limit: 10, page: 1 /*, ...filters */ }),
    keepPreviousData: true, // Útil para paginación para no ver saltos de UI
  });

  const getCurrentColumns = () => {
    switch (activeTab) {
      case 'transactions': return transactionColumns;
      case 'aidecisions': return aiDecisionColumns;
      case 'systemlogs': return systemLogColumns;
      default: return [];
    }
  };

  const renderCell = (row, column) => {
    let value = column.accessorKey.includes('.')
        ? column.accessorKey.split('.').reduce((obj, key) => obj && obj[key], row)
        : row[column.accessorKey];

    if (column.accessorKey === 'created_at' || column.accessorKey === 'timestamp') {
        return new Date(value).toLocaleString();
    }
    if (column.accessorKey === 'is_paper_trade') {
        return value ? 'Sí' : 'No';
    }
    if ((column.accessorKey === 'reason' || column.accessorKey === 'message') && typeof value === 'string') {
        return value.length > 100 ? value.substring(0, 97) + '...' : value;
    }
    if (typeof value === 'number' && (column.accessorKey === 'price' || column.accessorKey === 'quantity')) {
        // Asumiendo que 'pair' (con price_precision y quantity_precision) no está directamente en 'row' para logs.
        // Usar un default o si el par está (ej. row.pair.price_precision)
        const precision = column.accessorKey === 'price' ? (row.price_precision || 2) : (row.quantity_precision || 6);
        return value.toFixed(precision);
    }
    return String(value);
  };


  // DataTable mejorada para usar renderCell
const EnhancedDataTable = ({ data, columns, isLoading, error }) => {
  if (isLoading) return <p>Cargando datos...</p>;
  if (error) return <p className="text-destructive">Error: {error.message}</p>;
  if (!data || data.length === 0) return <p className="text-muted-foreground">No hay datos para mostrar.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            {columns.map(col => (
              <th key={col.accessorKey} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {data.map((row, rowIndex) => (
            <tr key={row.id || rowIndex}>
              {columns.map(col => (
                <td key={col.accessorKey} className="px-4 py-2 whitespace-nowrap text-sm" title={typeof row[col.accessorKey] === 'string' && row[col.accessorKey].length > 100 ? row[col.accessorKey] : ''}>
                  {renderCell(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Visor de Logs y Actividad</h1>

      <Tabs defaultValue="transactions" onValueChange={(value) => setActiveTab(value)} className="w-full">
        <TabsList>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="aidecisions">Decisiones IA</TabsTrigger>
          <TabsTrigger value="systemlogs">Logs del Sistema</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions">
          <EnhancedDataTable
            data={logData?.data}
            columns={transactionColumns}
            isLoading={isLoading || isFetching}
            error={error}
          />
          {/* TODO: Añadir controles de paginación y filtros aquí (Paso 25) */}
        </TabsContent>
        <TabsContent value="aidecisions">
          <EnhancedDataTable
            data={logData?.data}
            columns={aiDecisionColumns}
            isLoading={isLoading || isFetching}
            error={error}
          />
          {/* TODO: Añadir controles de paginación y filtros aquí (Paso 25) */}
        </TabsContent>
        <TabsContent value="systemlogs">
          <EnhancedDataTable
            data={logData?.data}
            columns={systemLogColumns}
            isLoading={isLoading || isFetching}
            error={error}
          />
          {/* TODO: Añadir controles de paginación y filtros aquí (Paso 25) */}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LogsPage;
