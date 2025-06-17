import axios from 'axios';

const API_BASE_URL = '/api/v1'; // Asumiendo que el frontend se sirve desde el mismo dominio o se usa proxy

const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username,
      password,
    });
    // El backend devuelve { message, token, user }
    return response.data;
  } catch (error) {
    // Re-lanzar el error para que el componente de UI pueda manejarlo
    // y mostrar mensajes al usuario.
    throw error;
  }
};

const register = async (username, password) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/register`, {
            username,
            password,
        });
        return response.data; // El backend devuelve { message, user }
    } catch (error) {
        throw error;
    }
};


// Podríamos añadir aquí:
// - logout (si implica invalidar token en backend, o solo limpiar localmente)
// - getCurrentUser (si se obtiene de un endpoint /me protegido)

export default {
  login,
  register,
};
