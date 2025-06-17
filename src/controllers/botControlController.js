const TradingService = require('../services/TradingService');
const logger = require('../utils/logger');

/**
 * Inicia el bucle de trading del bot.
 * Puede aceptar un 'intervalMs' opcional en el body para configurar el intervalo del tick.
 */
async function startBot(req, res) {
  const { intervalMs } = req.body; // Opcional

  if (TradingService.isLoopActive()) {
    logger.warn('[API][BotCtrl] Intento de iniciar el bot cuando ya está activo.');
    return res.status(409).json({ message: 'El bot ya está en funcionamiento.' });
  }

  try {
    // Si se proporciona intervalMs, usarlo. Si no, TradingService.startTradingLoop usará su default.
    TradingService.startTradingLoop(intervalMs);
    logger.info('[API][BotCtrl] Comando para iniciar el bot ejecutado.', { intervalMs: intervalMs || 'default' });
    res.status(200).json({ message: 'Bot iniciado exitosamente.' });
  } catch (error) {
    logger.error('[API][BotCtrl] Error al intentar iniciar el bot:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al iniciar el bot.' });
  }
}

/**
 * Detiene el bucle de trading del bot.
 */
async function stopBot(req, res) {
  if (!TradingService.isLoopActive()) {
    logger.warn('[API][BotCtrl] Intento de detener el bot cuando no está activo.');
    return res.status(409).json({ message: 'El bot no está en funcionamiento.' });
  }

  try {
    TradingService.stopTradingLoop();
    logger.info('[API][BotCtrl] Comando para detener el bot ejecutado.');
    res.status(200).json({ message: 'Bot detenido exitosamente.' });
  } catch (error) {
    logger.error('[API][BotCtrl] Error al intentar detener el bot:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al detener el bot.' });
  }
}

/**
 * Obtiene el estado actual del bot.
 */
async function getBotStatus(req, res) {
  try {
    const isActive = TradingService.isLoopActive();
    // En el futuro, podríamos añadir más información de estado aquí:
    // - Tiempo de actividad (uptime)
    // - Número de trades realizados en la sesión actual
    // - Estado de conexión con Binance, OpenAI, Ollama
    // - Pares actualmente monitoreados/operando
    // - Última vez que se ejecutó un tick
    const status = {
      isActive,
      message: isActive ? 'El bot está en funcionamiento.' : 'El bot está detenido.',
      timestamp: new Date().toISOString(),
      // TODO: Añadir más métricas de estado aquí.
    };
    logger.info('[API][BotCtrl] Se obtuvo el estado del bot.', { isActive });
    res.status(200).json(status);
  } catch (error) {
    logger.error('[API][BotCtrl] Error al obtener el estado del bot:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener el estado del bot.' });
  }
}

module.exports = {
  startBot,
  stopBot,
  getBotStatus,
};
