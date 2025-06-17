const db = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('[AuthController] FATAL: JWT_SECRET no está definido en el entorno. La autenticación JWT no funcionará.');
  // En un escenario real, podríamos querer que la aplicación no inicie si JWT_SECRET falta.
  // process.exit(1);
}

/**
 * Registra un nuevo usuario.
 */
async function register(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
  }
  if (password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      logger.warn(`[API][AuthCtrl] Intento de registrar usuario existente: ${username}`);
      return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, password_hash]
    );
    const newUser = rows[0];
    logger.info(`[API][AuthCtrl] Nuevo usuario registrado: ${username} (ID: ${newUser.id})`);

    // Opcional: ¿Generar y devolver un JWT directamente al registrar?
    // Por ahora, requeriremos un login separado.
    res.status(201).json({
      message: 'Usuario registrado exitosamente. Por favor, inicia sesión.',
      user: { id: newUser.id, username: newUser.username, createdAt: newUser.created_at }
    });

  } catch (error) {
    logger.error('[API][AuthCtrl] Error al registrar usuario:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
  }
}

/**
 * Inicia sesión de un usuario existente.
 */
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
  }
  if (!JWT_SECRET) { // Doble chequeo por si acaso, aunque ya se advirtió al inicio.
    logger.error('[API][AuthCtrl] JWT_SECRET no configurado, no se puede generar token.');
    return res.status(500).json({ message: 'Error de configuración del servidor: no se puede procesar el login.' });
  }

  try {
    const { rows } = await db.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    if (rows.length === 0) {
      logger.warn(`[API][AuthCtrl] Intento de login para usuario no existente: ${username}`);
      return res.status(401).json({ message: 'Credenciales inválidas.' }); // Mensaje genérico
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      logger.warn(`[API][AuthCtrl] Contraseña incorrecta para usuario: ${username}`);
      return res.status(401).json({ message: 'Credenciales inválidas.' }); // Mensaje genérico
    }

    // Actualizar last_login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const payload = {
      userId: user.id,
      username: user.username,
      // Podríamos añadir roles u otra info si la tuviéramos
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // Token expira en 1 día (configurable)

    logger.info(`[API][AuthCtrl] Usuario logueado exitosamente: ${username} (ID: ${user.id})`);
    res.status(200).json({
      message: 'Login exitoso.',
      token: token,
      user: { id: user.id, username: user.username }
    });

  } catch (error) {
    logger.error('[API][AuthCtrl] Error durante el login:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error interno del servidor durante el login.' });
  }
}

module.exports = {
  register,
  login,
};
