const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Obtiene todos los pares de trading.
 * Opcionalmente puede filtrar por is_active si se pasa como query param.
 */
async function getAllTradingPairs(req, res) {
  const { isActive } = req.query; // ej. /trading-pairs?isActive=true
  let query = 'SELECT * FROM trading_pairs ORDER BY symbol';
  const queryParams = [];

  if (isActive !== undefined) {
    query = 'SELECT * FROM trading_pairs WHERE is_active = $1 ORDER BY symbol';
    queryParams.push(isActive === 'true');
  }

  try {
    const { rows } = await db.query(query, queryParams);
    logger.info('[API][TradingPairsCtrl] Se obtuvieron pares de trading.', { count: rows.length, isActiveFilter: isActive });
    res.status(200).json(rows);
  } catch (error) {
    logger.error('[API][TradingPairsCtrl] Error al obtener pares de trading:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener pares de trading.' });
  }
}

/**
 * Obtiene un par de trading específico por su ID.
 */
async function getTradingPairById(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM trading_pairs WHERE id = $1', [id]);
    if (rows.length === 0) {
      logger.warn(`[API][TradingPairsCtrl] Par de trading con ID ${id} no encontrado.`);
      return res.status(404).json({ message: `Par de trading con ID ${id} no encontrado.` });
    }
    logger.info(`[API][TradingPairsCtrl] Se obtuvo el par de trading ID ${id}.`, { pair: rows[0] });
    res.status(200).json(rows[0]);
  } catch (error) {
    logger.error(`[API][TradingPairsCtrl] Error al obtener par de trading ID ${id}:`, { error: error.message });
    res.status(500).json({ message: 'Error al obtener el par de trading.' });
  }
}

/**
 * Añade un nuevo par de trading.
 * Campos requeridos en el body: symbol, base_asset, quote_asset.
 * Campos opcionales: is_active, min_trade_size, max_trade_size, tick_size, step_size, margin_enabled, price_precision, quantity_precision.
 */
async function addTradingPair(req, res) {
  const {
    symbol, base_asset, quote_asset, is_active = true,
    min_trade_size = 0, max_trade_size = null, tick_size = null, step_size = null,
    margin_enabled = false, price_precision = 8, quantity_precision = 8
  } = req.body;

  if (!symbol || !base_asset || !quote_asset) {
    return res.status(400).json({ message: 'Campos requeridos faltantes: symbol, base_asset, quote_asset.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO trading_pairs (symbol, base_asset, quote_asset, is_active, min_trade_size, max_trade_size, tick_size, step_size, margin_enabled, price_precision, quantity_precision, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [symbol.toUpperCase(), base_asset.toUpperCase(), quote_asset.toUpperCase(), is_active,
       min_trade_size, max_trade_size, tick_size, step_size, margin_enabled, price_precision, quantity_precision]
    );
    const newPair = rows[0];
    logger.info('[API][TradingPairsCtrl] Nuevo par de trading añadido:', { newPair });
    res.status(201).json(newPair);
  } catch (error) {
    // Manejar error de unicidad para 'symbol'
    if (error.code === '23505' && error.constraint === 'trading_pairs_symbol_key') {
      logger.warn(`[API][TradingPairsCtrl] Intento de añadir par duplicado: ${symbol}`, { body: req.body });
      return res.status(409).json({ message: `El par de trading con el símbolo '${symbol}' ya existe.` });
    }
    logger.error('[API][TradingPairsCtrl] Error al añadir nuevo par de trading:', { error: error.message, stack: error.stack, body: req.body });
    res.status(500).json({ message: 'Error al añadir el par de trading.' });
  }
}

/**
 * Actualiza un par de trading existente por su ID.
 * Se pueden actualizar todos los campos opcionales. Symbol, base_asset, quote_asset no deberían cambiar.
 */
async function updateTradingPair(req, res) {
  const { id } = req.params;
  const {
    is_active, min_trade_size, max_trade_size, tick_size, step_size,
    margin_enabled, price_precision, quantity_precision
    // No permitir cambiar symbol, base_asset, quote_asset vía este endpoint.
    // Si se necesita cambiar eso, es mejor borrar y crear uno nuevo para evitar inconsistencias.
  } = req.body;

  // Construir la query dinámicamente basada en los campos proporcionados
  const fieldsToUpdate = [];
  const values = [];
  let queryIndex = 1;

  if (is_active !== undefined) { fieldsToUpdate.push(`is_active = $${queryIndex++}`); values.push(is_active); }
  if (min_trade_size !== undefined) { fieldsToUpdate.push(`min_trade_size = $${queryIndex++}`); values.push(min_trade_size); }
  if (max_trade_size !== undefined) { fieldsToUpdate.push(`max_trade_size = $${queryIndex++}`); values.push(max_trade_size); }
  if (tick_size !== undefined) { fieldsToUpdate.push(`tick_size = $${queryIndex++}`); values.push(tick_size); }
  if (step_size !== undefined) { fieldsToUpdate.push(`step_size = $${queryIndex++}`); values.push(step_size); }
  if (margin_enabled !== undefined) { fieldsToUpdate.push(`margin_enabled = $${queryIndex++}`); values.push(margin_enabled); }
  if (price_precision !== undefined) { fieldsToUpdate.push(`price_precision = $${queryIndex++}`); values.push(price_precision); }
  if (quantity_precision !== undefined) { fieldsToUpdate.push(`quantity_precision = $${queryIndex++}`); values.push(quantity_precision); }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ message: 'No se proporcionaron campos para actualizar.' });
  }

  fieldsToUpdate.push(`last_updated = NOW()`); // Siempre actualizar last_updated
  values.push(id); // Para la cláusula WHERE

  const queryString = `UPDATE trading_pairs SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING *`;

  try {
    const { rows } = await db.query(queryString, values);
    if (rows.length === 0) {
      logger.warn(`[API][TradingPairsCtrl] Intento de actualizar par ID ${id} no encontrado.`);
      return res.status(404).json({ message: `Par de trading con ID ${id} no encontrado.` });
    }
    const updatedPair = rows[0];
    logger.info(`[API][TradingPairsCtrl] Par de trading ID ${id} actualizado:`, { updatedPair });
    res.status(200).json(updatedPair);
  } catch (error) {
    logger.error(`[API][TradingPairsCtrl] Error al actualizar par de trading ID ${id}:`, { error: error.message, stack: error.stack, body: req.body });
    res.status(500).json({ message: 'Error al actualizar el par de trading.' });
  }
}

/**
 * Elimina un par de trading por su ID.
 * Podríamos optar por un borrado suave (marcar is_active = false) en lugar de DELETE.
 * Por ahora, implementaremos borrado físico.
 */
async function deleteTradingPair(req, res) {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM trading_pairs WHERE id = $1 RETURNING id, symbol', [id]);
    if (result.rowCount === 0) {
      logger.warn(`[API][TradingPairsCtrl] Intento de eliminar par ID ${id} no encontrado.`);
      return res.status(404).json({ message: `Par de trading con ID ${id} no encontrado.` });
    }
    logger.info(`[API][TradingPairsCtrl] Par de trading ID ${id} (${result.rows[0].symbol}) eliminado.`);
    res.status(200).json({ message: `Par de trading ID ${id} (${result.rows[0].symbol}) eliminado exitosamente.` });
    // res.status(204).send(); // 204 No Content es otra opción para DELETE exitoso
  } catch (error) {
    // Considerar errores de FK si hay transacciones/decisiones ligadas a este par.
    // La DB schema actual no tiene ON DELETE CASCADE/RESTRICT explícito en transactions o ai_decisions hacia trading_pairs.
    // Si hay dependencias, el DELETE fallará si no se manejan.
    logger.error(`[API][TradingPairsCtrl] Error al eliminar par de trading ID ${id}:`, { error: error.message });
    res.status(500).json({ message: 'Error al eliminar el par de trading. Puede estar en uso.' });
  }
}


module.exports = {
  getAllTradingPairs,
  getTradingPairById,
  addTradingPair,
  updateTradingPair,
  deleteTradingPair,
};
