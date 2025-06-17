const express = require('express');
const router = express.Router();
const botControlController = require('../controllers/botControlController');
const { apiKeyAuth } = require('../middleware/authMiddleware'); // Importar middleware

// Iniciar el bot (POST - protegida)
router.post('/start', apiKeyAuth, botControlController.startBot);

// Detener el bot (POST - protegida)
router.post('/stop', apiKeyAuth, botControlController.stopBot);

// Obtener el estado del bot (GET - sin protección de escritura)
router.get('/status', botControlController.getBotStatus);

module.exports = router;
