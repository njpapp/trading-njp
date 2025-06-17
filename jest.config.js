module.exports = {
  testEnvironment: 'node', // Entorno de prueba para Node.js
  verbose: true, // Mostrar reportes detallados
  coveragePathIgnorePatterns: [ // Ignorar para cobertura de código
    '/node_modules/',
    '/database/', // Scripts SQL no necesitan cobertura de JS
    '/config/', // Archivos de configuración
    '/tests/mocks/', // Mocks no necesitan cobertura
    'src/server.js', // El archivo principal de servidor es más para pruebas de integración
    'src/app.js', // Si existiera un app.js separado
    'src/utils/simple-test-indicators.js', // Es un script de prueba, no parte de la app
  ],
  testMatch: [ // Patrón para encontrar archivos de prueba
    '**/tests/**/*.test.js', // Buscar archivos .test.js en cualquier subdirectorio de /tests
    '**/?(*.)+(spec|test).js', // Estándar de Jest
  ],
  // Podríamos añadir setupFilesAfterEnv para scripts de setup globales si es necesario.
  // setupFilesAfterEnv: ['./tests/setupTests.js'],
};
