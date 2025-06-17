const crypto = require('crypto');
const dotenv = require('dotenv');

// Asegurar que dotenv.config() se llama lo más pronto posible.
// Si hay un archivo .env en la raíz del proyecto, esto cargará las variables.
// Si se llama desde un punto de entrada que ya hizo dotenv.config(), no hay problema.
dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_HEX = process.env.API_ENCRYPTION_KEY;

// Inicializar con el fallback y luego intentar sobrescribir con la clave de .env
let encryptionKey = Buffer.from('0'.repeat(64), 'hex'); // Clave dummy por defecto
console.log('[SecurityModuleInit] encryptionKey inicializada con DUMMY por defecto.');

if (ENCRYPTION_KEY_HEX && ENCRYPTION_KEY_HEX.length === 64) {
  try {
    encryptionKey = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
    console.log('[SecurityModuleInit] encryptionKey configurada desde API_ENCRYPTION_KEY de .env.');
  } catch (e) {
    console.error('[SecurityModuleInit] Error al parsear API_ENCRYPTION_KEY (debe ser hex). Usando DUMMY key.', e);
    // encryptionKey ya tiene el valor dummy
  }
} else {
  if (!ENCRYPTION_KEY_HEX) {
    console.warn('[SecurityModuleInit] ADVERTENCIA: API_ENCRYPTION_KEY no está definida en .env. Usando DUMMY key para encriptación.');
  } else {
    console.warn(`[SecurityModuleInit] ADVERTENCIA: API_ENCRYPTION_KEY tiene longitud incorrecta (${ENCRYPTION_KEY_HEX.length}, se esperan 64). Usando DUMMY key para encriptación.`);
  }
  // encryptionKey ya tiene el valor dummy
}

// Verificar que encryptionKey es un Buffer y tiene la longitud correcta (32 bytes para aes-256)
if (!(encryptionKey instanceof Buffer) || encryptionKey.length !== 32) {
    console.error('[SecurityModuleInit] FALLO CRÍTICO: encryptionKey no es un Buffer de 32 bytes después de la inicialización. Algo está muy mal. Usando DUMMY key como último recurso.');
    encryptionKey = Buffer.from('0'.repeat(64), 'hex'); // Re-asegurar la dummy si todo falló
} else {
    console.log(`[SecurityModuleInit] encryptionKey final (hex): ${encryptionKey.toString('hex').substring(0,4)}...\${encryptionKey.toString('hex').substring(encryptionKey.toString('hex').length - 4)}`);
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
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv); // Use module-scoped encryptionKey
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
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv); // Use module-scoped encryptionKey
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
