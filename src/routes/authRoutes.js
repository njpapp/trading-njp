const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Registrar un nuevo usuario
router.post('/register', authController.register);

// Iniciar sesión
router.post('/login', authController.login);

module.exports = router;
