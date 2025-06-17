const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Helper para construir queries con paginación y filtros genéricos.
 * @param {string} baseQuery - La query SQL base (SELECT ... FROM table).
 * @param {object} filters - Objeto con los filtros a aplicar (ej. { pair_id: 1, type: 'BUY' }).
 * @param {object} queryParams - Objeto req.query para paginación (page, limit) y orden.
 * @param {string[]} allowedFilterFields - Array de campos permitidos para filtrar.
 * @param {string} defaultSort - Campo por el cual ordenar por defecto (ej. 'timestamp DESC').
 * @returns {{ pagedQuery: string, countQuery: string, values: any[] }}
 */
function buildPagedQuery(baseQuery, filters, queryParams, allowedFilterFields, defaultSort = 'id DESC') {
  let conditions = [];
  const values = [];
  let valueIndex = 1;

  // Aplicar filtros
  for (const field of allowedFilterFields) {
    if (filters[field] !== undefined && filters[field] !== null && filters[field] !== '') {
      // Manejar filtros de rango de fechas (asumiendo campos como 'start_date' y 'end_date' para un campo 'timestamp')
      if (field === 'start_date' && filters.timestamp_field) {
        conditions.push(`${filters.timestamp_field} >= $${valueIndex++}`);
        values.push(filters[field]);
      } else if (field === 'end_date' && filters.timestamp_field) {
        conditions.push(`${filters.timestamp_field} <= $${valueIndex++}`);
        values.push(filters[field]);
      } else if (field !== 'timestamp_field') { // No añadir timestamp_field como condición directa
        conditions.push(`${field} = $${valueIndex++}`);
        values.push(filters[field]);
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const finalBaseQuery = `${baseQuery} ${whereClause}`;

  const countQuery = `SELECT COUNT(*) AS total FROM (${finalBaseQuery}) AS subquery_count`;

  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || 25; // Default 25 items por página
  const offset = (page - 1) * limit;

  const sortBy = queryParams.sortBy || defaultSort.split(' ')[0];
  const sortOrder = (queryParams.sortOrder || defaultSort.split(' ')[1] || 'DESC').toUpperCase();
  if (!['ASC', 'DESC'].includes(sortOrder)) {
      // Prevenir SQL injection en sortOrder
      throw new Error('Invalid sortOrder value');
  }
  // Validar sortBy contra una lista de campos permitidos para ordenar sería ideal aquí.

  const pagedQuery = `${finalBaseQuery} ORDER BY ${sortBy} ${sortOrder} LIMIT $${valueIndex++} OFFSET $${valueIndex++}`;
  values.push(limit, offset);

  return { pagedQuery, countQuery, values };
}


/**
 * Obtiene transacciones con paginación y filtros.
 * Filtros posibles (query params): pair_id, type (BUY/SELL), mode (SPOT/MARGIN), status, start_date, end_date
 */
async function getTransactions(req, res) {
  const { pair_id, type, mode, status, start_date, end_date } = req.query;
  const filters = { pair_id, type, mode, status, start_date, end_date, timestamp_field: 'created_at' };
  const allowedFilterFields = ['pair_id', 'type', 'mode', 'status', 'start_date', 'end_date'];

  // Query base (unir con trading_pairs para obtener el símbolo)
  const baseQuery = `
    SELECT t.*, tp.symbol AS pair_symbol
    FROM transactions t
    LEFT JOIN trading_pairs tp ON t.pair_id = tp.id
  `;

  try {
    const { pagedQuery, countQuery, values: pagedValues } = buildPagedQuery(baseQuery, filters, req.query, allowedFilterFields, 'created_at DESC');

    // Extraer valores para countQuery (son los mismos que para pagedQuery ANTES de limit y offset)
    const countValues = pagedValues.slice(0, -2);

    const [dataResult, countResult] = await Promise.all([
      db.query(pagedQuery, pagedValues),
      db.query(countQuery, countValues)
    ]);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const limit = parseInt(req.query.limit, 10) || 25;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = parseInt(req.query.page, 10) || 1;

    logger.info('[API][DataViewCtrl] Se obtuvieron transacciones.', { page: currentPage, limit, totalItems });
    res.status(200).json({
      data: dataResult.rows,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      }
    });
  } catch (error) {
    logger.error('[API][DataViewCtrl] Error al obtener transacciones:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener transacciones.' });
  }
}


/**
 * Obtiene decisiones de IA con paginación y filtros.
 * Filtros: pair_id, decision (BUY/SELL/HOLD), ai_model_used, start_date, end_date
 */
async function getAIDecisions(req, res) {
  const { pair_id, decision, ai_model_used, start_date, end_date } = req.query;
  const filters = { pair_id, decision, ai_model_used, start_date, end_date, timestamp_field: 'timestamp' };
  const allowedFilterFields = ['pair_id', 'decision', 'ai_model_used', 'start_date', 'end_date'];

  const baseQuery = `
    SELECT ad.*, tp.symbol AS pair_symbol
    FROM ai_decisions ad
    LEFT JOIN trading_pairs tp ON ad.pair_id = tp.id
  `;

  try {
    const { pagedQuery, countQuery, values: pagedValues } = buildPagedQuery(baseQuery, filters, req.query, allowedFilterFields, 'timestamp DESC');
    const countValues = pagedValues.slice(0, -2);

    const [dataResult, countResult] = await Promise.all([
      db.query(pagedQuery, pagedValues),
      db.query(countQuery, countValues)
    ]);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const limit = parseInt(req.query.limit, 10) || 25;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = parseInt(req.query.page, 10) || 1;

    logger.info('[API][DataViewCtrl] Se obtuvieron decisiones de IA.', { page: currentPage, limit, totalItems });
    res.status(200).json({
      data: dataResult.rows,
      pagination: { currentPage, totalPages, totalItems, itemsPerPage: limit }
    });
  } catch (error) {
    logger.error('[API][DataViewCtrl] Error al obtener decisiones de IA:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener decisiones de IA.' });
  }
}

/**
 * Obtiene logs del sistema con paginación y filtros.
 * Filtros: level (INFO/WARN/ERROR/DEBUG), start_date, end_date
 */
async function getSystemLogs(req, res) {
  const { level, start_date, end_date } = req.query;
  const filters = { level, start_date, end_date, timestamp_field: 'timestamp' };
  const allowedFilterFields = ['level', 'start_date', 'end_date'];

  const baseQuery = 'SELECT * FROM system_logs';

  try {
    const { pagedQuery, countQuery, values: pagedValues } = buildPagedQuery(baseQuery, filters, req.query, allowedFilterFields, 'timestamp DESC');
    const countValues = pagedValues.slice(0, -2);

    const [dataResult, countResult] = await Promise.all([
      db.query(pagedQuery, pagedValues),
      db.query(countQuery, countValues)
    ]);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const limit = parseInt(req.query.limit, 10) || 25;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = parseInt(req.query.page, 10) || 1;

    logger.info('[API][DataViewCtrl] Se obtuvieron logs del sistema.', { page: currentPage, limit, totalItems });
    res.status(200).json({
      data: dataResult.rows,
      pagination: { currentPage, totalPages, totalItems, itemsPerPage: limit }
    });
  } catch (error) {
    logger.error('[API][DataViewCtrl] Error al obtener logs del sistema:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error al obtener logs del sistema.' });
  }
}

module.exports = {
  getTransactions,
  getAIDecisions,
  getSystemLogs,
};
