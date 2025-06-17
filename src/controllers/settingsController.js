const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Obtiene todas las configuraciones de la tabla 'settings'.
 */
async function getAllSettings(req, res) {
  try {
    const { rows } = await db.query('SELECT key, value, description, last_updated FROM settings ORDER BY key');
    logger.info('[API][SettingsController] Se obtuvieron todas las configuraciones.');
    res.status(200).json(rows);
  } catch (error) {
    logger.error('[API][SettingsController] Error al obtener todas las configuraciones:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener configuraciones de la base de datos.' });
  }
}

/**
 * Actualiza el valor de una configuración específica.
 * El 'key' se toma de los parámetros de la ruta (req.params).
 * El nuevo 'value' se toma del cuerpo de la solicitud (req.body).
 */
async function updateSetting(req, res) {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) { // Permitir valores vacíos, pero no 'undefined'
    return res.status(400).json({ message: 'El campo \"value\" es requerido en el cuerpo de la solicitud.' });
  }

  try {
    // Intentar actualizar. Si la clave no existe, no hará nada a menos que la creemos.
    // Por ahora, asumimos que las claves ya existen y solo se actualiza el valor.
    // La tabla 'settings' tiene algunas inserciones iniciales desde schema.sql.
    const result = await db.query(
      'UPDATE settings SET value = $1, last_updated = NOW() WHERE key = $2 RETURNING key, value, description, last_updated',
      [value, key]
    );

    if (result.rows.length === 0) {
      logger.warn(`[API][SettingsController] Intento de actualizar configuración no existente: ${key}`);
      // Opcional: Podríamos crear la clave si no existe, o devolver 404.
      // Por ahora, si no existe, no se actualiza y se devuelve 404.
      return res.status(404).json({ message: `Configuración con clave '${key}' no encontrada.` });
    }

    const updatedSetting = result.rows[0];
    logger.info(`[API][SettingsController] Configuración '${key}' actualizada a '${value}'.`, { updatedSetting });

    // TODO: Considerar si algún servicio necesita ser notificado de este cambio de configuración.
    // Por ejemplo, si se cambia LOG_LEVEL, el logger debería actualizarse.
    // Si se cambia OPENAI_ENABLED, AIService podría necesitar recargar su config.
    // Esto es para una fase de refinamiento.

    res.status(200).json(updatedSetting);
  } catch (error) {
    logger.error(`[API][SettingsController] Error al actualizar configuración '${key}':`, { error: error.message, stack: error.stack });
    res.status(500).json({ message: `Error al actualizar la configuración '${key}'.` });
  }
}

/**
 * Obtiene una configuración específica por su clave.
 */
async function getSettingByKey(req, res) {
  const { key } = req.params;
  try {
    const { rows } = await db.query('SELECT key, value, description, last_updated FROM settings WHERE key = $1', [key]);
    if (rows.length === 0) {
      logger.warn(`[API][SettingsController] Configuración con clave '${key}' no encontrada.`);
      return res.status(404).json({ message: `Configuración con clave '${key}' no encontrada.` });
    }
    logger.info(`[API][SettingsController] Se obtuvo la configuración: ${key}`);
    res.status(200).json(rows[0]);
  } catch (error) {
    logger.error(`[API][SettingsController] Error al obtener la configuración '${key}':`, { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener la configuración.' });
  }
}


module.exports = {
  getAllSettings,
  updateSetting,
  getSettingByKey, // Añadido para completar el CRUD básico
};
