const axios = require('axios');
const logger = require('../utils/logger');
const dotenv = require('dotenv');

dotenv.config(); // Para OLLAMA_BASE_URL

// URL base para la API de Ollama, configurable vía .env
// Ejemplo: OLLAMA_BASE_URL=http://localhost:11434
const OLLAMA_API_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
// El endpoint para chat con gemma:2b (u otros modelos) suele ser /api/chat

let isServiceAvailable = false; // Se verificará con una llamada de prueba

/**
 * Verifica la disponibilidad del servicio Ollama.
 * Intenta hacer una llamada simple (ej. listar modelos o un heartbeat si existe).
 */
async function initializeOllamaService() {
  if (!OLLAMA_API_BASE_URL) {
    logger.warn('[OllamaService] OLLAMA_BASE_URL no está configurada. El servicio Ollama no estará disponible.');
    isServiceAvailable = false;
    return false;
  }

  try {
    logger.info(`[OllamaService] Inicializando y probando conexión con Ollama en ${OLLAMA_API_BASE_URL}...`);
    // Ollama responde a GET / con "Ollama is running"
    // o podemos intentar listar modelos con GET /api/tags
    const response = await axios.get(`${OLLAMA_API_BASE_URL}/api/tags`, { timeout: 3000 }); // Timeout corto

    if (response.status === 200 && response.data && response.data.models) {
      // Verificar si gemma:2b está disponible (opcional, pero informativo)
      const gemmaExists = response.data.models.some(model => model.name.startsWith('gemma:2b'));
      if (gemmaExists) {
        logger.info('[OllamaService] Ollama está disponible y el modelo gemma:2b (o similar) parece estar presente.');
      } else {
        logger.warn('[OllamaService] Ollama está disponible, pero el modelo gemma:2b no fue encontrado en la lista de modelos. Asegúrate que está instalado en Ollama.');
      }
      isServiceAvailable = true;
      return true;
    } else {
      logger.warn(`[OllamaService] Ollama respondió, pero la respuesta no fue la esperada o no hay modelos. Status: ${response.status}`);
      isServiceAvailable = false;
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.warn(`[OllamaService] No se pudo conectar a Ollama en ${OLLAMA_API_BASE_URL}. Asegúrate que Ollama esté en ejecución y accesible. ${error.message}`);
    } else {
        logger.error('[OllamaService] Error durante la inicialización o prueba de conexión con Ollama:', { message: error.message });
    }
    isServiceAvailable = false;
    return false;
  }
}

/**
 * Envía un prompt a la API de Ollama y devuelve la respuesta del modelo.
 * @param {string} promptContent El contenido del prompt para el usuario.
 * @param {object} options Opciones adicionales para la solicitud a Ollama.
 * @param {string} options.model Modelo a usar (ej. 'gemma:2b'). Default 'gemma:2b'.
 * @param {string} options.systemMessage Mensaje opcional de sistema para guiar al modelo.
 * @param {object} options.ollamaOptions Opciones adicionales específicas de Ollama (ej. temperature, top_p).
 * @returns {Promise<string|null>} El contenido del mensaje de respuesta de la IA, o null si hay error.
 */
async function getDecision(promptContent, options = {}) {
  if (!isServiceAvailable) {
    logger.warn('[OllamaService] El servicio Ollama no está disponible o no inicializado. No se puede procesar la solicitud.');
    return null;
  }

  const {
    model = 'gemma:2b', // Modelo por defecto
    systemMessage = 'Eres un asistente experto en análisis de mercado de criptomonedas y estrategias de trading.',
    ollamaOptions = {} // Para pasar parámetros como temperature, top_p, etc.
  } = options;

  const messages = [{ role: 'system', content: systemMessage }];
  messages.push({ role: 'user', content: promptContent });

  const requestBody = {
    model,
    messages,
    stream: false, // Queremos la respuesta completa, no streaming
    options: ollamaOptions // ej. { temperature: 0.7, num_predict: 150 }
  };

  try {
    logger.debug(`[OllamaService] Enviando prompt a Ollama. Modelo: ${model}`, requestBody);
    const response = await axios.post(`${OLLAMA_API_BASE_URL}/api/chat`, requestBody, {
        headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.message && response.data.message.content) {
      logger.info('[OllamaService] Respuesta recibida de Ollama.');
      // logger.debug('[OllamaService] Contenido de la respuesta:', response.data.message.content);
      return response.data.message.content.trim();
    }

    logger.warn('[OllamaService] Respuesta de Ollama no contiene el contenido esperado:', response.data);
    return null;
  } catch (error) {
    if (error.response) {
      logger.error('[OllamaService] Error en la solicitud a Ollama:', {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      logger.error('[OllamaService] Error al conectar con Ollama:', { message: error.message });
    }
    return null;
  }
}

module.exports = {
  initializeOllamaService,
  getDecision,
  isServiceAvailable: () => isServiceAvailable,
};

// Ejemplo de cómo el servidor podría inicializarlo:
// const ollamaService = require('./services/OllamaService');
// ollamaService.initializeOllamaService().then(available => {
//   if (available) { // o ollamaService.isServiceAvailable()
//     // ... proceder a usar getDecision ...
//   }
// });
