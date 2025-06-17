const express = require('express');
const router = express.Router();
const tradingPairsController = require('../controllers/tradingPairsController');
const { apiKeyAuth } = require('../middleware/authMiddleware'); // Importar middleware

// Obtener todos los pares de trading (GET - sin protección de escritura)
router.get('/', tradingPairsController.getAllTradingPairs);

// Añadir un nuevo par de trading (POST - protegida)
router.post('/', apiKeyAuth, tradingPairsController.addTradingPair);

// Obtener un par de trading específico por ID (GET - sin protección de escritura)
router.get('/:id', tradingPairsController.getTradingPairById);

// Actualizar un par de trading existente por ID (PUT - protegida)
router.put('/:id', apiKeyAuth, tradingPairsController.updateTradingPair);

// Eliminar un par de trading por ID (DELETE - protegida)
router.delete('/:id', apiKeyAuth, tradingPairsController.deleteTradingPair);

module.exports = router;
