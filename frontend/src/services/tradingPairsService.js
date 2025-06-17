import axios from 'axios';

const API_BASE_URL = '/api/v1/trading-pairs'; // Base URL para este servicio

/**
 * Obtiene los pares de trading configurados.
 * @param {object} filters - Opcional. Ejemplo: { isActive: true }
 */
const getTradingPairs = async (filters = {}) => {
  try {
    const response = await axios.get(API_BASE_URL, { params: filters });
    return response.data; // Array de objetos de pares de trading
  } catch (error) {
    console.error('Error fetching trading pairs:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al obtener pares de trading.');
  }
};

/**
 * Añade un nuevo par de trading.
 * @param {object} pairData - Datos del par a añadir.
 *                          Ej: { symbol, base_asset, quote_asset, is_active, strategy_config, ... }
 */
const addTradingPair = async (pairData) => {
  try {
    const response = await axios.post(API_BASE_URL, pairData);
    return response.data;
  } catch (error) {
    console.error('Error adding trading pair:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al añadir par de trading.');
  }
};

/**
 * Actualiza un par de trading existente.
 * @param {number|string} pairId - ID del par a actualizar.
 * @param {object} pairData - Campos del par a actualizar.
 */
const updateTradingPair = async (pairId, pairData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/${pairId}`, pairData);
    return response.data;
  } catch (error) {
    console.error(`Error updating trading pair ${pairId}:`, error.response?.data || error.message);
    throw error.response?.data || new Error(`Error al actualizar par de trading ${pairId}.`);
  }
};

/**
 * Elimina un par de trading.
 * @param {number|string} pairId - ID del par a eliminar.
 */
const deleteTradingPair = async (pairId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/${pairId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting trading pair ${pairId}:`, error.response?.data || error.message);
    throw error.response?.data || new Error(`Error al eliminar par de trading ${pairId}.`);
  }
};


export default {
  getTradingPairs,
  addTradingPair,
  updateTradingPair,
  deleteTradingPair,
};
