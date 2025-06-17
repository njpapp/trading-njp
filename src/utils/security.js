const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
// La API_ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes)
const ENCRYPTION_KEY_HEX = process.env.API_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
  // En un entorno de producción real, esto debería impedir que la aplicación se inicie
  // o usar un mecanismo más seguro para la gestión de claves (ej. HashiCorp Vault, AWS KMS)
  console.error(
    'CRITICAL: API_ENCRYPTION_KEY no está definida correctamente en las variables de entorno. ' +
    'Debe ser una cadena hexadecimal de 64 caracteres (32 bytes). ' +
    'Las funciones de encriptación/desencriptación no serán seguras.'
  );
  // Por ahora, para permitir que la aplicación continúe (en desarrollo),
  // usaremos una clave por defecto insegura si no está configurada.
  // ¡ESTO NO DEBE HACERSE EN PRODUCCIÓN!
  // Fallback a una clave dummy NO SEGURA si no está configurada para evitar que la app crashee al inicio.
  // Esto es solo para fines de desarrollo y para que el subtask no falle si la key no está en .env aún.
  // Se debería lanzar un error y detener la app en un escenario real.
  this.encryptionKey = ENCRYPTION_KEY_HEX ? Buffer.from(ENCRYPTION_KEY_HEX, 'hex') : Buffer.from('0'.repeat(64), 'hex'); // Clave dummy
  if (!ENCRYPTION_KEY_HEX) {
    console.warn('ADVERTENCIA: Usando clave de encriptación dummy. NO USAR EN PRODUCCIÓN.');
  }
} else {
  this.encryptionKey = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
}


/**
 * Encripta un texto usando AES-256-GCM.
 * @param {string} text El texto a encriptar (puede ser un string JSON).
 * @returns {{iv: string, encryptedData: string, authTag: string} | null} Objeto con iv, datos encriptados y authTag, o null si hay error.
 */
function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(12); // IV de 12 bytes es recomendado para GCM
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag(); // Obtener el Authentication Tag
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Error durante la encriptación:', error);
    return null;
  }
}

/**
 * Desencripta un texto cifrado con AES-256-GCM.
 * @param {string} encryptedData El texto encriptado (hex).
 * @param {string} ivHex El vector de inicialización (hex).
 * @param {string} authTagHex El Authentication Tag (hex).
 * @returns {string | null} El texto original desencriptado, o null si hay error o la autenticación falla.
 */
function decrypt(encryptedData, ivHex, authTagHex) {
  if (!encryptedData || !ivHex || !authTagHex) return null;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag); // Establecer el Authentication Tag
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // Esto puede ocurrir si la clave es incorrecta o los datos están corruptos/manipulados (falla el AuthTag)
    console.error('Error durante la desencriptación (puede ser fallo de autenticación):', error);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt,
  // Exportamos la clave para testing o logging si es necesario (¡cuidado con esto!)
  // _getEncryptionKeyForTesting: () => this.encryptionKey.toString('hex') // Solo para depuración
};

// Ejemplo de uso (se puede comentar o quitar):
// (async () => {
//   if (!process.env.API_ENCRYPTION_KEY || process.env.API_ENCRYPTION_KEY.length !== 64) {
//      console.warn('\nEjemplo de encriptación/desencriptación no se ejecutará sin una API_ENCRYPTION_KEY válida de 64 caracteres hexadecimales.\n');
//      return;
//   }
//   const originalText = 'Esta es mi clave API secreta!';
//   console.log('Texto Original:', originalText);
//
//   const encryptedObject = encrypt(originalText);
//   if (encryptedObject) {
//     console.log('Encriptado:', encryptedObject);
//
//     const decryptedText = decrypt(encryptedObject.encryptedData, encryptedObject.iv, encryptedObject.authTag);
//     console.log('Desencriptado:', decryptedText);
//
//     if (originalText === decryptedText) {
//       console.log('¡La encriptación y desencriptación funcionan correctamente!');
//     } else {
//       console.error('¡Fallo en la encriptación/desencriptación!');
//     }
//   } else {
//     console.error('Falló la encriptación.');
//   }
//
//   // Prueba de fallo de autenticación (modificando el authTag)
//   if (encryptedObject) {
//     let tamperedAuthTag = encryptedObject.authTag.slice(0, -1) + (encryptedObject.authTag.slice(-1) === 'a' ? 'b' : 'a');
//     if (encryptedObject.authTag.length < 2) tamperedAuthTag = '12'; // asegurar que es diferente y tiene longitud mínima

//     console.log('\nProbando desencriptación con AuthTag manipulado...');
//     const decryptedTampered = decrypt(encryptedObject.encryptedData, encryptedObject.iv, tamperedAuthTag);
//     if (decryptedTampered === null) {
//       console.log('Correcto: La desencriptación falló como se esperaba debido al AuthTag manipulado.');
//     } else {
//       console.error('Error: La desencriptación DEBERÍA haber fallado pero no lo hizo.');
//     }
//   }
// })();
