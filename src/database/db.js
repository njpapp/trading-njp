const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config(); // Asegurarse que las variables de entorno están cargadas

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  // Opciones adicionales de Pool (ej. timeouts, ssl) pueden ir aquí
  // ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // connectionTimeoutMillis: 2000, // tiempo para esperar por una conexión del pool
  // idleTimeoutMillis: 30000, // tiempo para que un cliente inactivo permanezca en el pool
  // max: 20, // número máximo de clientes en el pool
});

const logger = require('../utils/logger'); // Import logger

// Función para probar la conexión
async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    logger.info('Conexión exitosa a la base de datos PostgreSQL.');
    const res = await client.query('SELECT NOW()');
    logger.info('Hora actual de la base de datos: ' + res.rows[0].now);
  } catch (err) {
    logger.error('Error al conectar con la base de datos PostgreSQL:', { error: err.stack });
    // Es importante relanzar el error o manejarlo para que el sistema sepa que la DB no está disponible
    throw err;
  } finally {
    if (client) {
      client.release(); // Liberar el cliente de vuelta al pool
    }
  }
}

// Exportar el pool para que pueda ser usado en otros módulos para hacer queries
// y la función de testConnection para poder verificar la conexión al iniciar la app.
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Exportar el pool directamente si se necesita más control (ej. transacciones)
  testConnection
};

// Podríamos llamar a testConnection() aquí si quisiéramos probarla inmediatamente al cargar este módulo,
// pero es mejor hacerlo explícitamente en el server.js al iniciar la aplicación.
// Ejemplo:
// if (require.main === module) { // Si este script es ejecutado directamente
//   testConnection().catch(e => console.error('Fallo el test de conexión directa.', e));
// }
