const logger = require('../utils/logger');
const dotenv = require('dotenv');

dotenv.config();

const EXPECTED_API_KEY = process.env.API_ACCESS_KEY;

if (!EXPECTED_API_KEY) {
  logger.warn('[AuthMiddleware] ADVERTENCIA: API_ACCESS_KEY no está configurada en el entorno. La autenticación de API estará deshabilitada o fallará para todas las solicitudes protegidas.');
  // No salimos, pero las rutas protegidas no funcionarán como se espera.
}

function apiKeyAuth(req, res, next) {
  if (!EXPECTED_API_KEY) {
    // Si no hay clave configurada en el servidor, denegar acceso a rutas que usen este middleware.
    // O, alternativamente, permitir acceso pero loguear una advertencia severa (menos seguro).
    logger.error('[AuthMiddleware] Intento de acceso a ruta protegida, pero API_ACCESS_KEY no está configurada en el servidor. Acceso denegado.');
    return res.status(500).json({ message: 'Error de configuración del servidor: Autenticación no configurada.' });
  }

  const providedApiKey = req.header('X-API-Key');

  if (!providedApiKey) {
    logger.warn(`[AuthMiddleware] Acceso denegado: Falta X-API-Key en la solicitud a ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'Acceso no autorizado: Falta la clave API en el header X-API-Key.' });
  }

  if (providedApiKey === EXPECTED_API_KEY) {
    logger.debug(`[AuthMiddleware] Acceso concedido con X-API-Key a ${req.method} ${req.originalUrl}`);
    next();
  } else {
    logger.warn(`[AuthMiddleware] Acceso denegado: X-API-Key inválida en la solicitud a ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ message: 'Acceso prohibido: Clave API inválida.' });
  }
}

module.exports = {
  apiKeyAuth,
};
