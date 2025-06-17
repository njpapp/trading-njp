const { encrypt, decrypt } = require('../../src/utils/security');
const crypto = require('crypto');

describe('Utils - security.js', () => {
  const originalText = 'Esta es una prueba secreta!';
  let encryptionKey; // Se tomará de process.env o el fallback del módulo

  beforeAll(() => {
    // Cargar dotenv para asegurar que process.env.API_ENCRYPTION_KEY esté disponible si existe en .env
    // Jest por defecto no carga .env, pero el módulo security.js sí lo hace internamente.
    // Si API_ENCRYPTION_KEY no está en .env, security.js usa una clave dummy (lo cual está bien para la lógica de la prueba).
    // Si queremos forzar una clave específica para la prueba, podríamos setear process.env.API_ENCRYPTION_KEY aquí.
    // Por ejemplo: process.env.API_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    // Pero confiemos en la inicialización del módulo por ahora.
    if (!process.env.API_ENCRYPTION_KEY) {
        console.warn('security.test.js: API_ENCRYPTION_KEY no definida en .env, usando clave dummy del módulo security.js para pruebas.');
    }
    // No necesitamos obtener la clave aquí, las funciones la usan internamente.
  });

  test('encrypt debería devolver un objeto con iv, encryptedData y authTag', () => {
    const encrypted = encrypt(originalText);
    expect(encrypted).toBeDefined();
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('encryptedData');
    expect(encrypted).toHaveProperty('authTag');
    expect(encrypted.iv).toMatch(/^[a-f0-9]{24}$/); // IV de 12 bytes en hex son 24 caracteres
    expect(encrypted.authTag).toMatch(/^[a-f0-9]{32}$/); // AuthTag de 16 bytes en hex son 32 caracteres
  });

  test('decrypt debería devolver el texto original con los datos correctos', () => {
    const encrypted = encrypt(originalText);
    expect(encrypted).not.toBeNull();
    if (encrypted) {
      const decrypted = decrypt(encrypted.encryptedData, encrypted.iv, encrypted.authTag);
      expect(decrypted).toBe(originalText);
    }
  });

  test('decrypt debería devolver null si el IV es incorrecto', () => {
    const encrypted = encrypt(originalText);
    expect(encrypted).not.toBeNull();
    if (encrypted) {
      // Generar un IV incorrecto (diferente al original)
      let tamperedIV = encrypted.iv;
      // Cambiar un carácter del IV
      tamperedIV = (tamperedIV.startsWith('a') ? 'b' : 'a') + tamperedIV.substring(1);
      if (tamperedIV === encrypted.iv) { // Asegurar que realmente cambió
          tamperedIV = tamperedIV.substring(0, tamperedIV.length -1) + (tamperedIV.endsWith('f') ? 'e' : 'f');
      }

      const decrypted = decrypt(encrypted.encryptedData, tamperedIV, encrypted.authTag);
      expect(decrypted).toBeNull();
    }
  });

  test('decrypt debería devolver null si el AuthTag es incorrecto', () => {
    const encrypted = encrypt(originalText);
    expect(encrypted).not.toBeNull();
    if (encrypted) {
      // Generar un AuthTag incorrecto
      let tamperedAuthTag = encrypted.authTag;
      tamperedAuthTag = (tamperedAuthTag.startsWith('a') ? 'b' : 'a') + tamperedAuthTag.substring(1);
       if (tamperedAuthTag === encrypted.authTag) {
          tamperedAuthTag = tamperedAuthTag.substring(0, tamperedAuthTag.length -1) + (tamperedAuthTag.endsWith('f') ? 'e' : 'f');
      }

      const decrypted = decrypt(encrypted.encryptedData, encrypted.iv, tamperedAuthTag);
      expect(decrypted).toBeNull(); // AES-GCM debería fallar la autenticación
    }
  });

  test('encrypt debería devolver null si el texto es vacío o nulo (según implementación)', () => {
    // La implementación actual devuelve null para texto vacío o nulo.
    expect(encrypt('')).toBeNull();
    expect(encrypt(null)).toBeNull();
  });

  test('decrypt debería devolver null si algún parámetro es nulo o inválido', () => {
    const encrypted = encrypt(originalText); // Necesitamos un IV y AuthTag válidos de referencia
    expect(encrypted).not.toBeNull();
    if (encrypted) {
        expect(decrypt(null, encrypted.iv, encrypted.authTag)).toBeNull();
        expect(decrypt(encrypted.encryptedData, null, encrypted.authTag)).toBeNull();
        expect(decrypt(encrypted.encryptedData, encrypted.iv, null)).toBeNull();
        expect(decrypt('invalido', encrypted.iv, encrypted.authTag)).toBeNull(); // Dato encriptado no hex
        expect(decrypt(encrypted.encryptedData, 'invalido', encrypted.authTag)).toBeNull(); // IV no hex
        expect(decrypt(encrypted.encryptedData, encrypted.iv, 'invalido')).toBeNull(); // AuthTag no hex
    }
  });

});
