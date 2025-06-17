const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { apiKeyAuth } = require('../middleware/authMiddleware'); // Importar middleware

// Obtener todas las configuraciones (GET - sin protección de escritura)
router.get('/', settingsController.getAllSettings);

// Obtener una configuración específica por clave (GET - sin protección de escritura)
router.get('/:key', settingsController.getSettingByKey);

// Actualizar una configuración específica por clave (PUT - protegida)
router.put('/:key', apiKeyAuth, settingsController.updateSetting);

module.exports = router;
