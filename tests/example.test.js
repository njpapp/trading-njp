// tests/example.test.js
describe('Ejemplo de Suite de Pruebas', () => {
  test('1 + 1 debería ser 2', () => {
    expect(1 + 1).toBe(2);
  });

  test('El entorno de Node debería estar disponible', () => {
    expect(typeof process).toBe('object');
  });
});
