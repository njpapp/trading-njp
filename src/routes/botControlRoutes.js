const express = require('express');
const router = express.Router();
const botControlController = require('../controllers/botControlController');
const { jwtAuth } = require('../middleware/authMiddleware'); // Usar jwtAuth

// Iniciar el bot (POST - protegida con JWT)
router.post('/start', jwtAuth, botControlController.startBot);

// Detener el bot (POST - protegida con JWT)
router.post('/stop', jwtAuth, botControlController.stopBot);

// Obtener el estado del bot (GET - sin protección de escritura)
router.get('/status', botControlController.getBotStatus);

module.exports = router;
