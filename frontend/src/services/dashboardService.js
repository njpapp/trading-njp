import axios from 'axios';

const API_BASE_URL = '/api/v1'; // Asumiendo que axios ya está configurado con el token en AuthContext

/**
 * Obtiene el estado actual del bot.
 */
const getBotStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/bot/status`);
    return response.data; // { isActive, message, timestamp }
  } catch (error) {
    console.error('Error fetching bot status:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al obtener estado del bot');
  }
};

/**
 * Obtiene las últimas transacciones.
 * @param {number} limit - Número de transacciones a obtener.
 */
const getRecentTransactions = async (limit = 5) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/view/transactions`, {
      params: {
        limit,
        page: 1,
        sortBy: 'created_at', // o 'executed_at'
        sortOrder: 'DESC',
      },
    });
    return response.data.data; // El backend devuelve { data: [], pagination: {} }
  } catch (error) {
    console.error('Error fetching recent transactions:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al obtener transacciones recientes');
  }
};

// Podríamos añadir aquí:
// - getOpenPositions (si el backend lo expone)
// - getPerformanceSummary (si el backend lo expone)

/**
 * Obtiene todas las configuraciones para filtrar las de IA.
 * Alternativamente, se podrían tener endpoints específicos o usar /settings/:key.
 */
const getAllSettings = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/settings`);
    return response.data; // Array de objetos { key, value, description }
  } catch (error) {
    console.error('Error fetching all settings:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al obtener todas las configuraciones');
  }
};

/**
 * Obtiene los últimos logs de error del sistema.
 * @param {number} limit - Número de logs de error a obtener.
 */
const getRecentErrorLogs = async (limit = 3) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/view/systemlogs`, {
      params: {
        limit,
        page: 1,
        level: 'ERROR', // Filtrar por nivel ERROR
        sortBy: 'timestamp',
        sortOrder: 'DESC',
      },
    });
    return response.data.data; // Array de logs
  } catch (error) {
    console.error('Error fetching recent error logs:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al obtener logs de error recientes');
  }
};

export default {
  getBotStatus,
  getRecentTransactions,
  getAllSettings, // Nueva función
  getRecentErrorLogs, // Nueva función
};
