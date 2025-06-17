const dotenv = require('dotenv');
dotenv.config();

// NO IMPORTAR db aquí: const db = require('../database/db');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let configuredLogLevelName = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
let configuredLogLevel = LOG_LEVELS[configuredLogLevelName] !== undefined ? LOG_LEVELS[configuredLogLevelName] : LOG_LEVELS.INFO;

let DB_LOGGING_ENABLED = process.env.DB_LOGGING_ENABLED === 'true';
let executeDbQuery = null; // Función para ejecutar queries, se inyectará
let dbLoggingInitialized = false;
let dbLoggingWarningLogged = false; // Para evitar spam de warnings

/**
 * Inicializa la capacidad de logging en base de datos.
 * @param {function} queryFunction - La función db.query(text, params) del módulo de base de datos.
 */
function initializeDatabaseLogging(queryFunction) {
  if (typeof queryFunction === 'function') {
    executeDbQuery = queryFunction;
    dbLoggingInitialized = true;
    console.log('[LoggerInit] Logging en base de datos inicializado y configurado.'); // Usar console.log aquí
  } else {
    console.error('[LoggerInit] Falló la inicialización del logging en DB: queryFunction no es una función.');
  }
}

// Función para actualizar el nivel de log dinámicamente (ej. desde settings)
function setLogLevel(levelName) {
    const newLevel = LOG_LEVELS[levelName.toUpperCase()];
    if (newLevel !== undefined) {
        configuredLogLevelName = levelName.toUpperCase();
        configuredLogLevel = newLevel;
        // Usar el logger para loguear esto, si ya está disponible, o console
        (logger.info || console.log)(`[Logger] Nivel de log configurado a: ${configuredLogLevelName}`);
    } else {
        (logger.warn || console.warn)(`[Logger] Intento de configurar nivel de log inválido: ${levelName}`);
    }
}

function setDbLoggingEnabled(isEnabled) {
    DB_LOGGING_ENABLED = isEnabled;
    (logger.info || console.log)(`[Logger] Logging en base de datos configurado a: ${DB_LOGGING_ENABLED}`);
}


function formatMessage(levelName, message, contextData) {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] [${levelName}] ${message}`;
  if (contextData && Object.keys(contextData).length > 0) {
    try {
      logEntry += ` - Context: ${JSON.stringify(contextData)}`;
    } catch (e) {
      console.warn('[LoggerFormat] Falló la serialización del context data para logging:', contextData);
    }
  }
  return logEntry;
}

async function logToDb(levelName, message, contextData) {
  if (!DB_LOGGING_ENABLED) {
    return;
  }
  if (!dbLoggingInitialized || typeof executeDbQuery !== 'function') {
    if (!dbLoggingWarningLogged) { // Loguear la advertencia solo una vez
        console.warn('[LoggerDB] Logging en base de datos no inicializado o función de query no disponible. Saltando log en DB.');
        dbLoggingWarningLogged = true;
    }
    return;
  }

  const validLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
  if (!validLevels.includes(levelName)) {
      console.warn(`[LoggerDB] Nivel de log inválido '${levelName}' para DB logging. Saltando.`);
      return;
  }

  const query = `
    INSERT INTO system_logs (level, message, context_data)
    VALUES ($1, $2, $3)
  `;
  try {
    const contextJson = contextData && Object.keys(contextData).length > 0 ? JSON.stringify(contextData) : null;
    await executeDbQuery(query, [levelName, message, contextJson]);
  } catch (error) {
    console.error('[LoggerDB] Falló la escritura del log en la base de datos:', error.message, 'Log Original:', formatMessage(levelName, message, contextData));
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
  initializeDatabaseLogging, // Exponer la función de inicialización
  setLogLevel, // Exponer para cambiar nivel dinámicamente
  setDbLoggingEnabled, // Exponer para cambiar dinámicamente
};

module.exports = logger;
