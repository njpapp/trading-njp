const logger = require('../utils/logger');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // Added

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
  jwtAuth,
};

const JWT_SECRET = process.env.JWT_SECRET; // Ya debería estar cargado por dotenv al inicio del archivo

function jwtAuth(req, res, next) {
  if (!JWT_SECRET) {
    logger.error('[AuthMiddleware][JWT] JWT_SECRET no configurado en el servidor. Autenticación JWT deshabilitada.');
    return res.status(500).json({ message: 'Error de configuración del servidor: Autenticación no disponible.' });
  }

  const authHeader = req.header('Authorization');

  if (!authHeader) {
    logger.warn(`[AuthMiddleware][JWT] Acceso denegado: Falta header 'Authorization' en la solicitud a ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'Acceso no autorizado: Token no proporcionado.' });
  }

  // El header debería ser "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    logger.warn(`[AuthMiddleware][JWT] Acceso denegado: Formato de token inválido en 'Authorization' header para ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: 'Acceso no autorizado: Formato de token inválido.' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Adjuntar payload del token (ej. { userId, username }) a req.user
    logger.debug(`[AuthMiddleware][JWT] Token JWT validado exitosamente para usuario: ${req.user.username} (ID: ${req.user.userId}). Acceso concedido a ${req.method} ${req.originalUrl}`);
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn(`[AuthMiddleware][JWT] Acceso denegado: Token JWT expirado para ${req.method} ${req.originalUrl}`, { error: error.message });
      return res.status(401).json({ message: 'Acceso no autorizado: Token expirado.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`[AuthMiddleware][JWT] Acceso denegado: Token JWT inválido (JsonWebTokenError) para ${req.method} ${req.originalUrl}`, { error: error.message });
      return res.status(401).json({ message: 'Acceso no autorizado: Token inválido.' });
    }
    // Otros errores
    logger.error(`[AuthMiddleware][JWT] Error inesperado al verificar token JWT para ${req.method} ${req.originalUrl}`, { error: error.message });
    return res.status(500).json({ message: 'Error interno al procesar el token.' });
  }
}
