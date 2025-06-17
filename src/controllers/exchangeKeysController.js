const db = require('../database/db');
const { encrypt } = require('../utils/security');
const logger = require('../utils/logger');
const BinanceService = require('../services/BinanceService'); // Para re-inicializar si las claves cambian
const OpenAIService = require('../services/OpenAIService');   // Para re-inicializar si las claves cambian

/**
 * Guarda o actualiza las claves API para un servicio específico (ej. 'binance', 'openai').
 * Las claves se reciben en el body y se encriptan antes de guardarlas.
 * Requiere autenticación JWT.
 */
async function saveExchangeKeys(req, res) {
  const { serviceName } = req.params; // 'binance' o 'openai'
  const { apiKey, secretKey } = req.body; // secretKey es opcional (para OpenAI)

  if (!serviceName || !apiKey) {
    return res.status(400).json({ message: 'serviceName y apiKey son requeridos.' });
  }

  if (serviceName.toLowerCase() === 'binance' && !secretKey) {
    return res.status(400).json({ message: 'secretKey es requerido para el servicio de Binance.' });
  }

  let credentialsToEncrypt;
  const lowerServiceName = serviceName.toLowerCase();

  if (lowerServiceName === 'binance') {
    if (!secretKey) {
      return res.status(400).json({ message: 'secretKey es requerido para el servicio de Binance.' });
    }
    credentialsToEncrypt = { apiKey, secretKey };
  } else if (lowerServiceName === 'openai') {
    credentialsToEncrypt = { apiKey }; // OpenAI solo usa apiKey
  } else if (lowerServiceName === 'openrouter') { // NUEVO CASO
    credentialsToEncrypt = { apiKey }; // OpenRouter solo usa apiKey
  } else {
    return res.status(400).json({ message: `Servicio '${serviceName}' no soportado para gestión de claves API.` });
  }

  try {
    const jsonCredentials = JSON.stringify(credentialsToEncrypt);
    const encryptedObject = encrypt(jsonCredentials);

    if (!encryptedObject) {
      logger.error(`[API][ExchangeKeysCtrl] Falló la encriptación de credenciales para ${serviceName}.`);
      return res.status(500).json({ message: 'Error al encriptar las credenciales.' });
    }

    const { encryptedData, iv, authTag } = encryptedObject;

    // Intentar UPSERT (INSERT o UPDATE si ya existe)
    const query = `
      INSERT INTO api_keys (service_name, encrypted_data, iv, auth_tag, description, last_updated)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (service_name)
      DO UPDATE SET
        encrypted_data = EXCLUDED.encrypted_data,
        iv = EXCLUDED.iv,
        auth_tag = EXCLUDED.auth_tag,
        description = EXCLUDED.description,
        last_updated = NOW()
      RETURNING service_name, description, last_updated;
    `;

    const description = `Claves para el servicio ${serviceName} actualizadas por usuario ${req.user?.username || 'desconocido'} (ID: ${req.user?.userId || 'desconocido'})`;

    const { rows } = await db.query(query, [serviceName.toLowerCase(), encryptedData, iv, authTag, description]);

    logger.info(`[API][ExchangeKeysCtrl] Claves API para '${serviceName}' guardadas/actualizadas exitosamente.`, { result: rows[0] });

    // Re-inicializar el servicio correspondiente para que tome las nuevas claves
    // Es importante que las funciones de inicialización puedan ser llamadas múltiples veces.
    // Y que manejen el caso de que el servicio ya esté 'activo' (ej. el cliente de Binance).
    // Las funciones de inicialización actuales ya tienen un flag 'isInitialized'.
    // Deberíamos resetear ese flag o tener una función de 'reInitialize'.
    // Por ahora, asumimos que llamar a initialize de nuevo funciona.
    // NOTA: Esto podría ser problemático si la inicialización tiene efectos secundarios no deseados al repetirse.
    // Un patrón mejor sería un event emitter o un mecanismo de 'hot reload' de config para los servicios.
    // Para este proyecto, una re-inicialización simple es un primer paso.
    if (lowerServiceName === 'binance' || lowerServiceName === 'openai' || lowerServiceName === 'openrouter') {
        logger.warn(`[API][ExchangeKeysCtrl] REINICIO DEL BOT REQUERIDO para que ${lowerServiceName} utilice las nuevas claves.`);
    }
    // Especificamente para Binance y OpenAI si tuvieran métodos de recarga:
    // if (lowerServiceName === 'binance') {
    //     // await BinanceService.reloadKeys();
    // } else if (lowerServiceName === 'openai') {
    //     // await OpenAIService.reloadKeys();
    // }


    res.status(200).json({ message: `Claves API para '${lowerServiceName}' guardadas/actualizadas exitosamente. Es posible que se requiera un reinicio del bot para aplicar los cambios.`, data: rows[0] });

  } catch (error) {
    logger.error(`[API][ExchangeKeysCtrl] Error al guardar claves API para ${lowerServiceName}:`, { error: error.message, stack: error.stack });
    res.status(500).json({ message: `Error al guardar claves API para ${lowerServiceName}.` });
  }
}

/**
 * Obtiene el estado de configuración de las claves para los servicios soportados.
 * No devuelve las claves, solo si están configuradas o no.
 */
async function getExchangeKeysStatus(req, res) {
    const services = ['binance', 'openai', 'openrouter']; // Servicios que gestionamos
    const statuses = {};
    try {
        for (const service of services) {
            const { rows } = await db.query("SELECT 1 FROM api_keys WHERE service_name = $1 LIMIT 1", [service]);
            statuses[service] = { configured: rows.length > 0 };
        }
        logger.info('[API][ExchangeKeysCtrl] Se obtuvo el estado de configuración de claves API.', { statuses });
        res.status(200).json(statuses);
    } catch (error) {
        logger.error('[API][ExchangeKeysCtrl] Error al obtener estado de claves API:', { error: error.message });
        res.status(500).json({ message: 'Error al obtener estado de configuración de claves API.' });
    }
}


module.exports = {
  saveExchangeKeys,
  getExchangeKeysStatus,
};
