const axios = require('axios');
const db = require('../database/db');
const { decrypt } = require('../utils/security');
const logger = require('../utils/logger');
const dotenv = require('dotenv'); // Para variables de entorno opcionales como HTTP_REFERER

dotenv.config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
let apiKey = null;
let isInitialized = false;

// Opcional: Configurar un User-Agent o HTTP-Referer para OpenRouter
const HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000'; // O el nombre de tu app/sitio
const X_TITLE = process.env.OPENROUTER_X_TITLE || 'TradingBotNodeJS';

/**
 * Inicializa el servicio de OpenRouter cargando la clave API desde la base de datos.
 */
async function initializeOpenRouterService() {
  if (isInitialized) {
    return true;
  }
  try {
    logger.info('[OpenRouterService] Inicializando servicio de OpenRouter...');
    const { rows } = await db.query(
      "SELECT encrypted_data, iv, auth_tag FROM api_keys WHERE service_name = 'openrouter' LIMIT 1"
    );

    if (rows.length === 0) {
      logger.warn('[OpenRouterService] No se encontró clave API para OpenRouter en la base de datos. El servicio no estará disponible.');
      isInitialized = false;
      apiKey = null;
      return false;
    }

    const apiKeyRecord = rows[0];
    const { encrypted_data, iv, auth_tag } = apiKeyRecord;

    if (!encrypted_data || !iv || !auth_tag) {
      logger.error('[OpenRouterService] Registro de clave API incompleto para OpenRouter.');
      isInitialized = false;
      apiKey = null;
      return false;
    }

    const decryptedJson = decrypt(encrypted_data, iv, auth_tag);
    if (!decryptedJson) {
      logger.error('[OpenRouterService] Falló la desencriptación de la clave API de OpenRouter.');
      isInitialized = false;
      apiKey = null;
      return false;
    }

    let credentials;
    try {
      credentials = JSON.parse(decryptedJson);
    } catch (parseError) {
      logger.error('[OpenRouterService] Falló el parseo del JSON de credenciales de OpenRouter.', { error: parseError.message });
      isInitialized = false;
      apiKey = null;
      return false;
    }

    if (!credentials.apiKey) {
      logger.error('[OpenRouterService] El JSON de credenciales de OpenRouter no contiene \"apiKey\".');
      isInitialized = false;
      apiKey = null;
      return false;
    }

    apiKey = credentials.apiKey;
    isInitialized = true;
    logger.info('[OpenRouterService] Servicio de OpenRouter inicializado correctamente.');
    return true;

  } catch (error) {
    logger.error('[OpenRouterService] Error durante la inicialización del servicio de OpenRouter:', { error: error.message, stack: error.stack });
    isInitialized = false;
    apiKey = null;
    return false;
  }
}

/**
 * Envía un prompt a la API de OpenRouter y devuelve la respuesta del modelo.
 * @param {string} promptContent El contenido del prompt para el usuario o sistema.
 * @param {object} options Opciones adicionales para la solicitud a OpenRouter.
 * @param {string} options.model Modelo a usar (ej. 'mistralai/mistral-7b-instruct', 'openai/gpt-4'). Default 'mistralai/mistral-7b-instruct'.
 * @param {number} options.temperature Temperatura para la generación. Default 0.7.
 * @param {number} options.max_tokens Máximo de tokens a generar. Default 500.
 * @param {string} options.systemMessage Mensaje opcional de sistema para guiar al modelo.
 * @returns {Promise<string|null>} El contenido del mensaje de respuesta de la IA, o null si hay error.
 */
async function getDecision(promptContent, options = {}) {
  if (!isInitialized || !apiKey) {
    logger.warn('[OpenRouterService] El servicio de OpenRouter no está inicializado o no se pudo cargar la API key.');
    return null;
  }

  const {
    model = 'mistralai/mistral-7b-instruct', // Un modelo gratuito popular como default
    temperature = 0.7,
    max_tokens = 500,
    systemMessage = 'Eres un asistente experto en análisis de mercado de criptomonedas y estrategias de trading.'
  } = options;

  const messages = [{ role: 'system', content: systemMessage }];
  messages.push({ role: 'user', content: promptContent });

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (HTTP_REFERER) {
    headers['HTTP-Referer'] = HTTP_REFERER;
  }
  if (X_TITLE) {
    headers['X-Title'] = X_TITLE;
  }

  try {
    logger.debug(`[OpenRouterService] Enviando prompt a OpenRouter. Modelo: ${model}`);

    const response = await axios.post(OPENROUTER_API_URL, {
      model,
      messages,
      temperature,
      max_tokens,
    }, { headers });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const choice = response.data.choices[0];
      if (choice.message && choice.message.content) {
        logger.info('[OpenRouterService] Respuesta recibida de OpenRouter.');
        return choice.message.content.trim();
      }
    }
    logger.warn('[OpenRouterService] Respuesta de OpenRouter no contiene el contenido esperado:', response.data);
    return null;
  } catch (error) {
    if (error.response) {
      logger.error('[OpenRouterService] Error en la solicitud a OpenRouter:', {
        status: error.response.status,
        data: error.response.data,
        modelUsed: model // Incluir el modelo en el log de error
      });
    } else {
      logger.error('[OpenRouterService] Error al conectar con OpenRouter:', { message: error.message, modelUsed: model });
    }
    return null;
  }
}

module.exports = {
  initializeOpenRouterService,
  getDecision,
  isServiceInitialized: () => isInitialized,
};

// Ejemplo de cómo insertar la clave API de OpenRouter en la DB:
// Usa el script encrypt_api_keys.js (modificando SERVICE_NAME, ACTUAL_API_KEY, etc.)
// Para OpenRouter, el JSON a encriptar sería: { "apiKey": "sk-or-..." }
/*
--- encrypt_api_keys.js (modificado para OpenRouter) ---
...
const SERVICE_NAME = 'openrouter';
const ACTUAL_API_KEY = 'TU_OPENROUTER_API_KEY_REAL'; // Ejemplo: sk-or-*****************
const KEY_DESCRIPTION = 'Clave API para OpenRouter.ai';

const credentials = {
  apiKey: ACTUAL_API_KEY
};
... (el resto del script es igual)
*/
