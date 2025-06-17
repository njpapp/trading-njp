const express = require('express');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = express();
const db = require('./database/db');
const logger = require('./utils/logger');
const binanceService = require('./services/BinanceService');
const openAIService = require('./services/OpenAIService'); // Import OpenAIService
const ollamaService = require('./services/OllamaService'); // Import OllamaService
const openRouterService = require('./services/OpenRouterService'); // NUEVO
const apiRoutes = require('./routes/index'); // NUEVA IMPORTACIÓN
const PORT = process.env.PORT || 3000;

app.use(express.json()); // Middleware para parsear bodies JSON

// API Routes
app.use('/api/v1', apiRoutes);

app.get('/', (req, res) => {
  res.send('Servidor de Autotrading en funcionamiento!');
});

db.testConnection().then(async () => { // Hacer esta función anónima async
  // Mensaje de conexión exitosa a DB ya está en db.js y logger.info en server.js
  try {
    await binanceService.initializeBinanceClient();
    logger.info('[Server] BinanceService inicializado correctamente.');

    // Intentar inicializar OpenAI Service (no crítico si falla)
    try {
      if (await openAIService.initializeOpenAIService()) {
        logger.info("[Server] OpenAIService inicializado correctamente.");
      } else {
        logger.warn("[Server] OpenAIService no se pudo inicializar (puede ser por falta de config o error). Continuará sin OpenAI.");
      }
    } catch (openAIInitError) {
      logger.error("[Server] Ocurrió un error durante la inicialización de OpenAIService:", { error: openAIInitError.message });
      logger.warn("[Server] Continuará sin OpenAIService.");
    }

    // Intentar inicializar Ollama Service (no crítico si falla)
    try {
      if (await ollamaService.initializeOllamaService()) {
        logger.info("[Server] OllamaService parece estar disponible.");
      } else {
        logger.warn("[Server] OllamaService no está disponible o no se pudo inicializar (verifique URL y si Ollama está en ejecución). Continuará sin Ollama.");
      }
    } catch (ollamaInitError) {
      logger.error("[Server] Ocurrió un error durante la inicialización de OllamaService:", { error: ollamaInitError.message });
      logger.warn("[Server] Continuará sin OllamaService.");
    }

    // Intentar inicializar OpenRouter Service (no crítico si falla)
    try {
      if (await openRouterService.initializeOpenRouterService()) {
        logger.info("[Server] OpenRouterService inicializado correctamente.");
      } else {
        logger.warn("[Server] OpenRouterService no se pudo inicializar (puede ser por falta de config o error). Continuará sin OpenRouterService.");
      }
    } catch (openRouterInitError) {
      logger.error("[Server] Ocurrió un error durante la inicialización de OpenRouterService:", { error: openRouterInitError.message });
      logger.warn("[Server] Continuará sin OpenRouterService.");
    }

    app.listen(PORT, () => {
      logger.info(`[Server] Servidor escuchando en el puerto ${PORT} con BinanceService activo.`);
    });
  } catch (binanceError) {
    logger.error('[Server] Error crítico al inicializar BinanceService. El bot podría no operar con normalidad.', { error: binanceError.message, stack: binanceError.stack });
    // Decidir si la app debe salir o continuar con funcionalidad limitada.
    // Por ahora, iniciaremos el servidor igualmente para permitir acceso a APIs de configuración o reintentos manuales.
    app.listen(PORT, () => {
        logger.warn(`[Server] Servidor escuchando en el puerto ${PORT}, PERO BinanceService NO PUDO INICIALIZARSE.`);
    });
  }
}).catch(dbError => {
  // El logger.error ya está aquí para el fallo de conexión a la DB
  logger.error('Error fatal: No se pudo conectar a la base de datos. El servidor no se iniciará.', { error: dbError.message });
  process.exit(1); // Salir si no se puede conectar a la DB
});

// Placeholder para futuras rutas y configuraciones
// const apiRoutes = require('./routes/api');
// app.use('/api', apiRoutes);

module.exports = app; // Exportar app para posibles pruebas
