const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { jwtAuth } = require('../middleware/authMiddleware'); // Usar jwtAuth

// Obtener todas las configuraciones (GET - sin protección de escritura)
router.get('/', settingsController.getAllSettings);

// Obtener una configuración específica por clave (GET - sin protección de escritura)
router.get('/:key', settingsController.getSettingByKey);

// Actualizar una configuración específica por clave (PUT - protegida con JWT)
router.put('/:key', jwtAuth, settingsController.updateSetting);

module.exports = router;
