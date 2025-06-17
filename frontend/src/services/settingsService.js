import axios from 'axios';

const API_BASE_URL = '/api/v1'; // Axios ya debería estar configurado con el token por AuthContext

/**
 * Obtiene el estado de configuración de las claves API para todos los servicios.
 * (binance, openai, openrouter)
 */
const getApiKeysStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/exchange-keys/status`);
    return response.data; // Espera: { binance: { configured: true/false }, openai: ..., openrouter: ... }
  } catch (error) {
    console.error('Error fetching API keys status:', error.response?.data || error.message);
    throw error.response?.data || new Error('Error al obtener estado de claves API.');
  }
};

/**
 * Guarda/Actualiza las claves API para un servicio específico.
 * @param {string} serviceName - 'binance', 'openai', 'openrouter'
 * @param {object} keys - Objeto con las claves (ej. { apiKey, secretKey } para binance)
 */
const saveApiKeys = async (serviceName, keys) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/exchange-keys/${serviceName.toLowerCase()}`, keys);
    return response.data; // Espera: { message, data: { service_name, ... } }
  } catch (error) {
    console.error(`Error saving API keys for ${serviceName}:`, error.response?.data || error.message);
    throw error.response?.data || new Error(`Error al guardar claves API para ${serviceName}.`);
  }
};

/**
 * Obtiene todas las configuraciones generales del bot.
 */
const getAllBotSettings = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/settings`);
        return response.data; // Array de objetos { key, value, description }
    } catch (error) {
        console.error('Error fetching all bot settings:', error.response?.data || error.message);
        throw error.response?.data || new Error('Error al obtener todas las configuraciones del bot.');
    }
};

/**
 * Actualiza una configuración específica del bot.
 * @param {string} key - La clave de la configuración a actualizar.
 * @param {string|boolean|number} value - El nuevo valor para la configuración.
 */
const updateBotSetting = async (key, value) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/settings/${key}`, { value: String(value) }); // Asegurar que el valor sea string si la API lo espera así
        return response.data;
    } catch (error) {
        console.error(`Error updating bot setting ${key}:`, error.response?.data || error.message);
        throw error.response?.data || new Error(`Error al actualizar la configuración ${key}.`);
    }
};


export default {
  getApiKeysStatus,
  saveApiKeys,
  getAllBotSettings,
  updateBotSetting,
};
