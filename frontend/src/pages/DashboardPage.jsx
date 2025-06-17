import React from 'react';
import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import Alert from '../components/ui/Alert'; // Importar Alert
// import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'; // Ejemplo shadcn
// import { AlertCircle, TrendingUp, List } from 'lucide-react'; // Iconos

// Componente placeholder para shadcn Card (se añadiría con CLI)
const Card = ({ children, className }) => <div className={`border border-border rounded-lg shadow-md p-4 ${className}`}>{children}</div>;
const CardHeader = ({ children, className }) => <div className={`mb-2 ${className}`}>{children}</div>;
const CardTitle = ({ children, className }) => <h3 className={`text-xl font-semibold ${className}`}>{children}</h3>;
const CardDescription = ({ children, className }) => <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>;
const CardContent = ({ children, className }) => <div className={className}>{children}</div>;


const DashboardPage = () => {
  const { data: botStatus, isLoading: isLoadingStatus, error: errorStatus } = useQuery({
    queryKey: ['botStatus'],
    queryFn: dashboardService.getBotStatus,
    refetchInterval: 10000, // Refrescar estado del bot cada 10 segundos
  });

  const { data: recentTransactions, isLoading: isLoadingTransactions, error: errorTransactions } = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: () => dashboardService.getRecentTransactions(5),
    refetchInterval: 30000, // Refrescar transacciones cada 30 segundos
  });

  const { data: allSettings, isLoading: isLoadingSettings, error: errorSettings } = useQuery({
    queryKey: ['allSettings'],
    queryFn: dashboardService.getAllSettings,
  });

  const { data: recentErrorLogs, isLoading: isLoadingErrorLogs, error: errorErrorLogs } = useQuery({
    queryKey: ['recentErrorLogs'],
    queryFn: () => dashboardService.getRecentErrorLogs(3),
  });

  // Procesar settings para alertas de IA
  const openaiEnabled = React.useMemo(() => {
    if (!allSettings) return null;
    const setting = allSettings.find(s => s.key === 'OPENAI_ENABLED');
    return setting ? setting.value === 'true' : null;
  }, [allSettings]);

  const ollamaEnabled = React.useMemo(() => {
    if (!allSettings) return null;
    const setting = allSettings.find(s => s.key === 'OLLAMA_ENABLED');
    return setting ? setting.value === 'true' : null;
  }, [allSettings]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Dashboard Principal</h1>

      {/* Sección de Alertas */}
      <div className="space-y-4 mb-6">
        {isLoadingSettings && <Alert title="Cargando configuración de IA..." />}
        {errorSettings && <Alert variant="destructive" title="Error al cargar settings">{errorSettings.message}</Alert>}
        {openaiEnabled === false && (
          <Alert variant="warning" title="OpenAI Desactivado">
            El servicio de OpenAI está actualmente desactivado en la configuración.
          </Alert>
        )}
        {ollamaEnabled === false && (
          <Alert variant="warning" title="Ollama Desactivado">
            El servicio de Ollama está actualmente desactivado en la configuración.
          </Alert>
        )}
        {openaiEnabled === false && ollamaEnabled === false && (
          <Alert variant="destructive" title="Sin Servicios de IA Activos">
            Tanto OpenAI como Ollama están desactivados. El bot no podrá tomar decisiones basadas en IA.
          </Alert>
        )}
        {isLoadingErrorLogs && <Alert title="Cargando logs de error..." />}
        {errorErrorLogs && <Alert variant="destructive" title="Error al cargar logs del sistema">{errorErrorLogs.message}</Alert>}
        {recentErrorLogs && recentErrorLogs.length > 0 && (
          <Alert variant="destructive" title={`Errores Críticos Recientes (${recentErrorLogs.length})`}>
            <ul className="list-disc list-inside">
              {recentErrorLogs.map(log => (
                <li key={log.id} className="truncate" title={log.message}>
                  {`[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message.substring(0,100)}`}{log.message.length > 100 ? '...' : ''}
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card Estado del Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {/* <Bot size={20} className="mr-2" /> */} IconoBot
              Estado del Bot
            </CardTitle>
            <CardDescription>Estado actual del servicio de trading.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStatus && <p>Cargando estado...</p>}
            {errorStatus && <p className="text-destructive">Error: {errorStatus.message}</p>}
            {botStatus && (
              <p className={botStatus.isActive ? 'text-green-500' : 'text-red-500'}>
                {botStatus.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Placeholder para Ganancias/Pérdidas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {/* <TrendingUp size={20} className="mr-2" /> */} IconoStats
              Rendimiento General
            </CardTitle>
            <CardDescription>Resumen de ganancias y pérdidas.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">(Placeholder para P&L)</p>
          </CardContent>
        </Card>

        {/* Placeholder para Notificaciones */}
         <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {/* <AlertCircle size={20} className="mr-2" /> */} IconoAlerta
              Alertas y Notificaciones
            </CardTitle>
             <CardDescription>Eventos importantes del sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">(Placeholder para Alertas)</p>
          </CardContent>
        </Card>
      </div>

        {/* Card Gráfico Transacciones Recientes */}
        <Card className="col-span-1 md:col-span-3"> {/* Ajustado para ocupar todo el ancho en MD y LG */}
          <CardHeader>
            <CardTitle className="flex items-center">
              {/* <BarChartHorizontalBig size={20} className="mr-2" /> */} IconoGrafico
              Actividad Reciente (Valor Total por Transacción)
            </CardTitle>
            <CardDescription>Visualización del valor total de las últimas transacciones.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions && <p>Cargando datos para el gráfico...</p>}
            {errorTransactions && <p className="text-destructive">Error cargando datos del gráfico: {errorTransactions.message}</p>}
            {recentTransactions && recentTransactions.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}> {/* Contenedor responsivo para Recharts */}
                <ResponsiveContainer>
                  <BarChart
                    data={recentTransactions.map(tx => ({
                        name: `${tx.pair_symbol || tx.pair_id} (${new Date(tx.executed_at || tx.created_at).toLocaleTimeString()})`,
                        valor: parseFloat(tx.cummulative_quote_qty), // Usar cummulative_quote_qty para valor
                        tipo: tx.type
                    }))}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value.toLocaleString()}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend wrapperStyle={{ fontSize: "14px" }} />
                    <Bar dataKey="valor" name="Valor Total (Moneda Cotizada)">
                      {recentTransactions.map((tx, index) => (
                        <Cell key={`cell-${index}`} fill={tx.type === 'BUY' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              !isLoadingTransactions && <p className="text-muted-foreground">No hay datos suficientes para mostrar el gráfico de actividad.</p>
            )}
          </CardContent>
        </Card>

      {/* Card Transacciones Recientes */}
      <Card className="col-span-1 md:col-span-3"> {/* Ajustado para ocupar todo el ancho en MD y LG */}
        <CardHeader>
          <CardTitle className="flex items-center">
            {/* <List size={20} className="mr-2" /> */} IconoLista
            Transacciones Recientes
          </CardTitle>
          <CardDescription>Últimas 5 transacciones registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTransactions && <p>Cargando transacciones...</p>}
          {errorTransactions && <p className="text-destructive">Error: {errorTransactions.message}</p>}
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Par</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Modo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Precio</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Cantidad</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Paper</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(tx.executed_at || tx.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{tx.pair_symbol || tx.pair_id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{tx.type}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{tx.mode}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{parseFloat(tx.price).toFixed(2)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{parseFloat(tx.quantity).toFixed(6)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{tx.status}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{tx.is_paper_trade ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !isLoadingTransactions && <p className="text-muted-foreground">No hay transacciones recientes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
