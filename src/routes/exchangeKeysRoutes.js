const express = require('express');
const router = express.Router();
const exchangeKeysController = require('../controllers/exchangeKeysController');
const { jwtAuth } = require('../middleware/authMiddleware'); // Proteger con JWT

// Guardar/Actualizar claves API para un servicio (ej. /binance, /openai)
// Esta ruta debe estar protegida, ya que maneja credenciales sensibles.
router.post('/:serviceName', jwtAuth, exchangeKeysController.saveExchangeKeys);

// Obtener el estado de configuración de las claves (si están seteadas o no)
router.get('/status', jwtAuth, exchangeKeysController.getExchangeKeysStatus);

module.exports = router;
