const axios = require('axios');
const db = require('../database/db');
const { decrypt } = require('../utils/security');
const logger = require('../utils/logger');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
let apiKey = null;
let isInitialized = false;

/**
 * Inicializa el servicio de OpenAI cargando la clave API desde la base de datos.
 */
async function initializeOpenAIService() {
  if (isInitialized) {
    return true;
  }
  try {
    logger.info('[OpenAIService] Inicializando servicio de OpenAI...');
    const { rows } = await db.query(
      "SELECT encrypted_data, iv, auth_tag FROM api_keys WHERE service_name = 'openai' LIMIT 1"
    );

    if (rows.length === 0) {
      logger.warn('[OpenAIService] No se encontró clave API para OpenAI en la base de datos (tabla api_keys, servicio openai). El servicio no estará disponible.');
      // No lanzamos error aquí para permitir que la app funcione sin OpenAI si no está configurado.
      // Las llamadas a getDecision fallarán si no está inicializado.
      isInitialized = false; // Marcar explícitamente como no inicializado.
      apiKey = null;
      return false;
    }

    const apiKeyRecord = rows[0];
    const { encrypted_data, iv, auth_tag } = apiKeyRecord;

    if (!encrypted_data || !iv || !auth_tag) {
      logger.error('[OpenAIService] Registro de clave API incompleto en la base de datos para OpenAI.');
      isInitialized = false;
      apiKey = null;
      return false; // Opcional: lanzar error si se considera crítico
    }

    const decryptedJson = decrypt(encrypted_data, iv, auth_tag);
    if (!decryptedJson) {
      logger.error('[OpenAIService] Falló la desencriptación de la clave API de OpenAI.');
      isInitialized = false;
      apiKey = null;
      return false; // Opcional: lanzar error
    }

    let credentials;
    try {
      credentials = JSON.parse(decryptedJson);
    } catch (parseError) {
      logger.error('[OpenAIService] Falló el parseo del JSON de credenciales de OpenAI.', { error: parseError.message });
      isInitialized = false;
      apiKey = null;
      return false; // Opcional: lanzar error
    }

    if (!credentials.apiKey) {
      logger.error('[OpenAIService] El JSON de credenciales de OpenAI no contiene \'apiKey\'.');
      isInitialized = false;
      apiKey = null;
      return false; // Opcional: lanzar error
    }

    apiKey = credentials.apiKey;
    isInitialized = true;
    logger.info('[OpenAIService] Servicio de OpenAI inicializado correctamente.');
    return true;

  } catch (error) {
    logger.error('[OpenAIService] Error durante la inicialización del servicio de OpenAI:', { error: error.message, stack: error.stack });
    isInitialized = false;
    apiKey = null;
    return false; // Opcional: relanzar error si la inicialización de OpenAI es crítica para la app
  }
}

/**
 * Envía un prompt a la API de OpenAI y devuelve la respuesta del modelo.
 * @param {string} promptContent El contenido del prompt para el usuario o sistema.
 * @param {object} options Opciones adicionales para la solicitud de OpenAI.
 * @param {string} options.model Modelo a usar (ej. 'gpt-3.5-turbo', 'gpt-4'). Default 'gpt-3.5-turbo'.
 * @param {number} options.temperature Temperatura para la generación. Default 0.7.
 * @param {number} options.max_tokens Máximo de tokens a generar. Default 150.
 * @param {string} options.systemMessage Mensaje opcional de sistema para guiar al modelo.
 * @returns {Promise<string|null>} El contenido del mensaje de respuesta de la IA, o null si hay error.
 */
async function getDecision(promptContent, options = {}) {
  if (!isInitialized || !apiKey) {
    logger.warn('[OpenAIService] El servicio de OpenAI no está inicializado o no se pudo cargar la API key. No se puede procesar la solicitud.');
    return null;
  }

  const {
    model = 'gpt-3.5-turbo',
    temperature = 0.7,
    max_tokens = 500, // Aumentado para decisiones de trading potencialmente más largas
    systemMessage = 'Eres un asistente experto en análisis de mercado de criptomonedas y estrategias de trading.'
  } = options;

  const messages = [{ role: 'system', content: systemMessage }];
  messages.push({ role: 'user', content: promptContent });

  try {
    logger.debug(`[OpenAIService] Enviando prompt a OpenAI. Modelo: ${model}, Temp: ${temperature}, MaxTokens: ${max_tokens}`);
    // logger.debug('[OpenAIService] Prompt messages:', messages); // Puede ser muy verboso

    const response = await axios.post(OPENAI_API_URL, {
      model,
      messages,
      temperature,
      max_tokens,
      // top_p: 1, // Otra opción de control de generación
      // frequency_penalty: 0,
      // presence_penalty: 0,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const choice = response.data.choices[0];
      if (choice.message && choice.message.content) {
        logger.info('[OpenAIService] Respuesta recibida de OpenAI.');
        // logger.debug('[OpenAIService] Contenido de la respuesta:', choice.message.content);
        return choice.message.content.trim();
      }
    }
    logger.warn('[OpenAIService] Respuesta de OpenAI no contiene el contenido esperado:', response.data);
    return null;
  } catch (error) {
    if (error.response) {
      logger.error('[OpenAIService] Error en la solicitud a OpenAI:', {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      logger.error('[OpenAIService] Error al conectar con OpenAI:', { message: error.message });
    }
    return null;
  }
}

module.exports = {
  initializeOpenAIService,
  getDecision,
  isServiceInitialized: () => isInitialized, // Para verificar externamente si está listo
};

// Ejemplo de cómo el servidor podría inicializarlo:
// const openAIService = require('./services/OpenAIService');
// openAIService.initializeOpenAIService().then(success => {
//   if (success) { // o openAIService.isServiceInitialized()
//     // ... proceder a usar getDecision ...
//   }
// });

// Ejemplo de cómo insertar la clave API de OpenAI en la DB (similar a Binance):
// Necesitarás tu API_ENCRYPTION_KEY en .env y tu clave API de OpenAI.
// Usa el script encrypt_api_keys.js (modificando SERVICE_NAME, ACTUAL_API_KEY, etc.)
// Para OpenAI, el JSON a encriptar sería: { "apiKey": "sk-..." }
/*
--- encrypt_api_keys.js (modificado para OpenAI) ---
...
const SERVICE_NAME = 'openai';
const ACTUAL_API_KEY = 'TU_OPENAI_API_KEY_REAL'; // Ejemplo: sk-xxxxxxxxxxxxxxx
const KEY_DESCRIPTION = 'Clave API para OpenAI GPT';

// No hay secretKey para OpenAI, así que el JSON es más simple
const credentials = {
  apiKey: ACTUAL_API_KEY
};
... (el resto del script es igual)
*/
