const express = require('express');
const router = express.Router();
const tradingPairsController = require('../controllers/tradingPairsController');
const { jwtAuth } = require('../middleware/authMiddleware'); // Usar jwtAuth

// Obtener todos los pares de trading (GET - sin protección de escritura)
router.get('/', tradingPairsController.getAllTradingPairs);

// Añadir un nuevo par de trading (POST - protegida con JWT)
router.post('/', jwtAuth, tradingPairsController.addTradingPair);

// Obtener un par de trading específico por ID (GET - sin protección de escritura)
router.get('/:id', tradingPairsController.getTradingPairById);

// Actualizar un par de trading existente por ID (PUT - protegida con JWT)
router.put('/:id', jwtAuth, tradingPairsController.updateTradingPair);

// Eliminar un par de trading por ID (DELETE - protegida con JWT)
router.delete('/:id', jwtAuth, tradingPairsController.deleteTradingPair);

module.exports = router;
