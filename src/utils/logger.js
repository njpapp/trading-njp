const db = require('../database/db'); // Importar el módulo de DB para logging en base de datos
const dotenv = require('dotenv');

dotenv.config();

// Niveles de Log (inspirados en RFC5424 syslog levels)
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Obtener el nivel de log configurado (desde .env o DB setting más adelante)
// Por ahora, usaremos una variable de entorno, con INFO como default.
const configuredLogLevelName = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const configuredLogLevel = LOG_LEVELS[configuredLogLevelName] !== undefined ? LOG_LEVELS[configuredLogLevelName] : LOG_LEVELS.INFO;

// Flag para habilitar/deshabilitar el logging en DB (podría ser una config de DB también)
const DB_LOGGING_ENABLED = process.env.DB_LOGGING_ENABLED === 'true';

function formatMessage(levelName, message, contextData) {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] [${levelName}] ${message}`;
  if (contextData && Object.keys(contextData).length > 0) {
    try {
      logEntry += ` - Context: ${JSON.stringify(contextData)}`;
    } catch (e) {
      // Ignorar error de serialización de contexto, pero loguearlo una vez
      console.warn('Failed to serialize context data for logging:', contextData);
    }
  }
  return logEntry;
}

async function logToDb(levelName, message, contextData) {
  if (!DB_LOGGING_ENABLED) {
    return;
  }

  // Validar que el levelName es uno de los definidos en el ENUM de la DB
  const validLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
  if (!validLevels.includes(levelName)) {
      console.warn(`[Logger] Invalid log level '${levelName}' for DB logging. Skipping.`);
      return;
  }

  const query = `
    INSERT INTO system_logs (level, message, context_data)
    VALUES ($1, $2, $3)
  `;
  try {
    // Convertir contextData a JSONB, o null si está vacío o es inválido
    const contextJson = contextData && Object.keys(contextData).length > 0 ? JSON.stringify(contextData) : null;
    await db.query(query, [levelName, message, contextJson]);
  } catch (error) {
    // Si falla el logging en DB, escribir en consola para no perder el error de logging
    console.error('[Logger] Failed to write log to database:', error.message, 'Original log:', formatMessage(levelName, message, contextData));
  }
}

const logger = {
  debug: (message, contextData = {}) => {
    if (configuredLogLevel <= LOG_LEVELS.DEBUG) {
      console.debug(formatMessage('DEBUG', message, contextData));
      logToDb('DEBUG', message, contextData);
    }
  },
  info: (message, contextData = {}) => {
    if (configuredLogLevel <= LOG_LEVELS.INFO) {
      console.info(formatMessage('INFO', message, contextData));
      logToDb('INFO', message, contextData);
    }
  },
  warn: (message, contextData = {}) => {
    if (configuredLogLevel <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, contextData));
      logToDb('WARN', message, contextData);
    }
  },
  error: (message, contextData = {}) => {
    if (configuredLogLevel <= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, contextData));
      logToDb('ERROR', message, contextData);
    }
  },
  // Método para cambiar el nivel de log dinámicamente si es necesario (ej. desde config de DB)
  // setLevel: (levelName) => {
  //   const newLevel = LOG_LEVELS[levelName.toUpperCase()];
  //   if (newLevel !== undefined) {
  //     configuredLogLevel = newLevel;
  //     console.log(formatMessage('INFO', `Log level set to ${levelName.toUpperCase()}`));
  //   } else {
  //     console.warn(formatMessage('WARN', `Attempted to set invalid log level: ${levelName}`));
  //   }
  // }
};

// Ejemplo de uso (se puede comentar o quitar)
// logger.debug('Este es un mensaje de debug.', { userId: 123 });
// logger.info('Este es un mensaje informativo.');
// logger.warn('Esto es una advertencia.', { value: 'test' });
// logger.error('Ocurrió un error!', { errorDetails: 'stack trace...' });

module.exports = logger;
