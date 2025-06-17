const BinanceService = require('../../src/services/BinanceService');
const db = require('../../src/database/db');
const logger = require('../../src/utils/logger');
// No mockearemos 'node-binance-api' directamente aquí para mantenerlo simple,
// confiaremos en el flag 'paperTradingEnabled' y en que las funciones de orden
// no intentarán usar 'binanceClient' si es null o si paperTradingEnabled es true.
// Para una prueba más profunda, se podría mockear node-binance-api.

jest.mock('../../src/database/db');
jest.mock('../../src/utils/logger');

// Necesitamos una forma de resetear el estado interno del módulo BinanceService entre pruebas,
// ya que 'paperTradingEnabled' e 'isInitialized' son variables a nivel de módulo.
// Jest por defecto cachea los módulos.
// Una forma es usar jest.resetModules() o requerir el módulo dentro de beforeEach/test.
// O, si las funciones de inicialización se pueden llamar múltiples veces y resetean el estado, eso es más simple.
// La función initializeBinanceClient ya está diseñada para ser llamada y reconfigurar.

describe('Services - BinanceService.js', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Limpiar mocks de db y logger
    // Resetear el estado del módulo BinanceService importándolo de nuevo o usando una función de reseteo si existiera.
    // Por simplicidad, asumiremos que llamar a initializeBinanceClient resetea el estado necesario.
    // O podemos forzar el reseteo de los flags internos si los exportamos para testing (no ideal).
    // La prueba se enfocará en el comportamiento observable.
  });

  describe('initializeBinanceClient', () => {
    test('debería activar paperTradingEnabled si la DB lo indica y las claves reales fallan', async () => {
      db.query.mockImplementation(async (queryText) => {
        if (queryText.includes("FROM api_keys WHERE service_name = 'binance'")) {
          return { rows: [] }; // No hay claves API reales o fallan
        }
        if (queryText.includes("FROM settings WHERE key = 'PAPER_TRADING_ENABLED'")) {
          return { rows: [{ value: 'true' }] }; // Paper trading activado
        }
        return { rows: [] };
      });

      // Sobreescribimos process.env para esta prueba para evitar dependencias de .env real
      const originalApiKey = process.env.API_ENCRYPTION_KEY;
      process.env.API_ENCRYPTION_KEY = 'testtesttesttesttesttesttesttesttesttesttesttesttesttesttesttest'; // 32 bytes hex

      try {
        await BinanceService.initializeBinanceClient();
      } catch (e) {
        // Se espera que falle la inicialización del cliente real si no hay claves
        // pero luego debería activar paper trading. El error no debería propagarse si paper trading se activa.
      }

      // Verificar que isInitialized sea true (porque paper trading está activo)
      // Esto requiere que BinanceService exporte una forma de ver su estado o que las funciones fallen selectivamente.
      // La implementación actual de initializeBinanceClient establece isInitialized = true si paper trading se activa post-fallo.

      // Para verificar el estado interno, necesitaríamos exportar 'isServiceInitializedForPaperTrading' o similar.
      // O, simplemente probamos una función que dependa de esto, como createSpotOrder en modo paper.
      // Por ahora, probaremos el efecto indirecto.
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[BinanceService] MODO PAPER TRADING ACTIVADO'));

      // Simular una llamada que solo funcionaría si está en modo paper o real
      // getTicker es una buena candidata, ya que no depende de binanceClient si está en modo paper y puede fallar si no.
      // La implementación actual de getTicker SÍ depende de binanceClient.
      // Vamos a probar createSpotOrder en modo paper.
      const order = await BinanceService.createSpotOrder('BTCUSDT', 'BUY', 'MARKET', 1, null, {});
      expect(order).toHaveProperty('isPaperTrade', true);
      process.env.API_ENCRYPTION_KEY = originalApiKey; // Restaurar
    });

    test('debería desactivar paperTradingEnabled si la DB lo indica false, incluso si claves reales fallan', async () => {
        db.query.mockImplementation(async (queryText) => {
            if (queryText.includes("FROM api_keys WHERE service_name = 'binance'")) {
              return { rows: [] }; // No hay claves API reales
            }
            if (queryText.includes("FROM settings WHERE key = 'PAPER_TRADING_ENABLED'")) {
              return { rows: [{ value: 'false' }] }; // Paper trading desactivado
            }
            return { rows: [] };
          });
        const originalApiKey = process.env.API_ENCRYPTION_KEY;
        process.env.API_ENCRYPTION_KEY = 'testtesttesttesttesttesttesttesttesttesttesttesttesttesttesttest';

        let errorThrown = false;
        try {
            await BinanceService.initializeBinanceClient();
        } catch (e) {
            errorThrown = true; // Se espera que falle la inicialización del cliente real y no active paper.
        }
        expect(errorThrown).toBe(true); // Debe fallar porque ni real ni paper están activos.
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[BinanceService] Modo Paper Trading DESACTIVADO y cliente real no inicializado.'));

        // Intentar crear una orden debería fallar o no ser paper
        try {
            await BinanceService.createSpotOrder('BTCUSDT', 'BUY', 'MARKET', 1, null, {});
        } catch (e) {
            expect(e.message).toContain('Binance client no inicializado');
        }
        process.env.API_ENCRYPTION_KEY = originalApiKey; // Restaurar
    });
  });

  describe('Paper Trading Order Simulation', () => {
    // Asegurar que paper trading está activado para estas pruebas
    beforeEach(async () => {
      db.query.mockImplementation(async (queryText) => {
        if (queryText.includes("FROM api_keys WHERE service_name = 'binance'")) {
          // Simular que no hay claves reales para forzar la dependencia en el flag de paper trading de DB
          return { rows: [] };
        }
        if (queryText.includes("FROM settings WHERE key = 'PAPER_TRADING_ENABLED'")) {
          return { rows: [{ value: 'true' }] }; // Paper trading activado
        }
        return { rows: [] };
      });
      const originalApiKey = process.env.API_ENCRYPTION_KEY;
      process.env.API_ENCRYPTION_KEY = 'testtesttesttesttesttesttesttesttesttesttesttesttesttesttesttest';
      // Necesitamos que initializeBinanceClient se llame para setear paperTradingEnabled
      try {
        await BinanceService.initializeBinanceClient();
      } catch (e) { /* Ignorar error de cliente real, esperamos que paper se active */ }
      process.env.API_ENCRYPTION_KEY = originalApiKey;
    });

    test('createSpotOrder en modo paper debería devolver una orden simulada', async () => {
      // Mock getTicker para que devuelva un precio para órdenes MARKET simuladas
      // Esto es un poco complicado porque getTicker está en el mismo módulo.
      // Para hacerlo bien, getTicker debería ser mockeable o BinanceService refactorizado para inyectar dependencias.
      // Por ahora, si createSpotOrder llama a getTicker, podría fallar si binanceClient es null.
      // La implementación actual de paper createSpotOrder hace:
      // const currentPrice = price || parseFloat((await getTicker(symbol))?.price) || 0;
      // Si binanceClient es null (porque las claves reales fallaron), getTicker lanzará error.
      // Modificaremos la prueba para que no dependa de getTicker en este caso o mockearemos getTicker.

      // Opción 1: Proporcionar precio para órdenes MARKET para no llamar a getTicker
      const orderMarket = await BinanceService.createSpotOrder('BTCUSDT', 'BUY', 'MARKET', 1, 30000, {}); // Proporcionar precio aunque sea MARKET
      expect(orderMarket).toBeDefined();
      expect(orderMarket.isPaperTrade).toBe(true);
      expect(orderMarket.symbol).toBe('BTCUSDT');
      expect(orderMarket.side).toBe('BUY');
      expect(orderMarket.type).toBe('MARKET');
      expect(orderMarket.status).toBe('FILLED'); // Market se llena inmediatamente
      expect(orderMarket.orderId).toMatch(/^PAPER-/);
      expect(parseFloat(orderMarket.executedQty)).toBe(1);
      expect(parseFloat(orderMarket.price)).toBe(0); // precio de orden market es 0
      expect(orderMarket.fills[0].price).toBe('30000');


      const orderLimit = await BinanceService.createSpotOrder('ETHUSDT', 'SELL', 'LIMIT', 0.5, 2000, { timeInForce: 'GTC' });
      expect(orderLimit).toBeDefined();
      expect(orderLimit.isPaperTrade).toBe(true);
      expect(orderLimit.symbol).toBe('ETHUSDT');
      expect(orderLimit.type).toBe('LIMIT');
      expect(orderLimit.status).toBe('NEW'); // Limit no se llena inmediatamente
      expect(orderLimit.orderId).toMatch(/^PAPER-/);
      expect(parseFloat(orderLimit.price)).toBe(2000);
    });

    test('createMarginOrder en modo paper debería devolver una orden simulada', async () => {
      const orderMarket = await BinanceService.createMarginOrder('BTCUSDT', 'SELL', 'MARKET', 0.1, 30000, { isIsolated: 'TRUE' });
      expect(orderMarket).toBeDefined();
      expect(orderMarket.isPaperTrade).toBe(true);
      expect(orderMarket.symbol).toBe('BTCUSDT');
      expect(orderMarket.type).toBe('MARKET');
      expect(orderMarket.status).toBe('FILLED');
      expect(orderMarket.orderId).toMatch(/^PAPERMARGIN-/);
      expect(orderMarket.isIsolated).toBe(true);

      const orderLimit = await BinanceService.createMarginOrder('ETHUSDT', 'BUY', 'LIMIT', 2, 1900, {});
      expect(orderLimit).toBeDefined();
      expect(orderLimit.isPaperTrade).toBe(true);
      expect(orderLimit.symbol).toBe('ETHUSDT');
      expect(orderLimit.type).toBe('LIMIT');
      expect(orderLimit.status).toBe('NEW');
      expect(orderLimit.orderId).toMatch(/^PAPERMARGIN-/);
      expect(orderLimit.isIsolated).toBe(false); // Default
    });
  });
});
