import axios from 'axios';

const API_BASE_URL_VIEW = '/api/v1/view'; // Base URL para los endpoints de visualización

/**
 * Obtiene datos paginados y filtrados.
 * @param {string} endpoint - 'transactions', 'aidecisions', 'systemlogs'
 * @param {object} params - Query params para paginación y filtros (page, limit, sortBy, sortOrder, etc.)
 */
const getLogs = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL_VIEW}/${endpoint}`, { params });
    return response.data; // Espera: { data: [], pagination: {} }
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error.response?.data || error.message);
    throw error.response?.data || new Error(`Error al obtener datos de ${endpoint}.`);
  }
};

export default {
  getLogs,
};
