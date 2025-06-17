const express = require('express');
const router = express.Router();
const settingsRoutes = require('./settingsRoutes');
const tradingPairsRoutes = require('./tradingPairsRoutes');
const botControlRoutes = require('./botControlRoutes');
const dataViewRoutes = require('./dataViewRoutes');
const authRoutes = require('./authRoutes');
const exchangeKeysRoutes = require('./exchangeKeysRoutes'); // Importar exchangeKeysRoutes
const logger = require('../utils/logger'); // Para loguear montaje de rutas

// Middleware para loguear todas las solicitudes a la API (opcional)
router.use((req, res, next) => {
  logger.debug(`[API] Solicitud entrante: ${req.method} ${req.originalUrl}`, { query: req.query, body: req.body });
  next();
});

// Montar rutas específicas
router.use('/settings', settingsRoutes);
logger.info('[API] Rutas de /settings montadas.');

router.use('/trading-pairs', tradingPairsRoutes);
logger.info('[API] Rutas de /trading-pairs montadas.');

router.use('/bot', botControlRoutes);
logger.info('[API] Rutas de /bot (control) montadas.');

router.use('/view', dataViewRoutes);
logger.info('[API] Rutas de /view (datos) montadas.');

router.use('/auth', authRoutes);
logger.info('[API] Rutas de /auth montadas.');

router.use('/exchange-keys', exchangeKeysRoutes);
logger.info('[API] Rutas de /exchange-keys montadas.');

// Ruta de prueba para la API
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'API saludable', timestamp: new Date().toISOString() });
});

module.exports = router;
