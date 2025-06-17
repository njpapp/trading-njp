const express = require('express');
const router = express.Router();
const dataViewController = require('../controllers/dataViewController');

// Obtener transacciones con paginación y filtros
router.get('/transactions', dataViewController.getTransactions);

// Obtener decisiones de IA con paginación y filtros
router.get('/aidecisions', dataViewController.getAIDecisions);

// Obtener logs del sistema con paginación y filtros
router.get('/systemlogs', dataViewController.getSystemLogs);

module.exports = router;
