const indicators = require('../../src/utils/indicators');

// Datos de prueba (similares a los de simple-test-indicators.js pero más controlados)
const sampleKlines = [
  { open: 10, high: 15, low: 9, close: 11, volume: 100 },   // 0
  { open: 11, high: 16, low: 10, close: 12, volume: 110 },  // 1
  { open: 12, high: 17, low: 11, close: 13, volume: 120 },  // 2
  { open: 13, high: 18, low: 12, close: 14, volume: 130 },  // 3
  { open: 14, high: 19, low: 13, close: 15, volume: 140 },  // 4
  { open: 15, high: 20, low: 14, close: 16, volume: 150 },  // 5
  { open: 16, high: 21, low: 15, close: 17, volume: 160 },  // 6
  { open: 17, high: 22, low: 16, close: 18, volume: 170 },  // 7
  { open: 18, high: 23, low: 17, close: 19, volume: 180 },  // 8
  { open: 19, high: 24, low: 18, close: 20, volume: 190 },  // 9
  { open: 20, high: 25, low: 19, close: 21, volume: 200 },  // 10
  { open: 21, high: 22, low: 18, close: 19, volume: 210 },  // 11 - Baja
  { open: 19, high: 20, low: 17, close: 18, volume: 190 },  // 12
  { open: 18, high: 19, low: 16, close: 17, volume: 180 },  // 13
  { open: 17, high: 18, low: 15, close: 16, volume: 170 },  // 14
  { open: 16, high: 17, low: 14, close: 15, volume: 160 },  // 15
];
const closePrices = sampleKlines.map(k => k.close); // [11,12,13,14,15,16,17,18,19,20,21,19,18,17,16,15]

describe('Utils - indicators.js', () => {
  describe('getClosePrices', () => {
    test('debería extraer correctamente los precios de cierre', () => {
      expect(indicators.getClosePrices(sampleKlines)).toEqual(closePrices);
    });
    test('debería devolver un array vacío para entrada vacía o inválida', () => {
      expect(indicators.getClosePrices([])).toEqual([]);
      expect(indicators.getClosePrices(null)).toEqual([]);
      expect(indicators.getClosePrices([{}])).toEqual([undefined]); // map devuelve undefined si no hay .close
    });
  });

  describe('calculateSMA', () => {
    test('debería calcular SMA correctamente', () => {
      const sma5 = indicators.calculateSMA(closePrices, 5);
      // SMA5: (11+12+13+14+15)/5 = 13 (índice 4)
      // (12+13+14+15+16)/5 = 14 (índice 5)
      // ...
      // (17+16+15)/3 = ? La librería devuelve menos puntos. SMA(period=5) sobre 16 puntos devuelve 16-5+1 = 12 puntos.
      expect(sma5).toBeInstanceOf(Array);
      expect(sma5.length).toBe(closePrices.length - 5 + 1);
      expect(sma5[0]).toBeCloseTo(13); // Primer valor de SMA(5)
      expect(sma5[1]).toBeCloseTo(14);
      expect(sma5[sma5.length - 1]).toBeCloseTo((19+18+17+16+15)/5); // (17.0)
    });
    test('debería devolver null si no hay suficientes datos para SMA', () => {
      expect(indicators.calculateSMA(closePrices.slice(0, 3), 5)).toBeNull();
    });
  });

  describe('calculateEMA', () => {
    // EMA es más difícil de verificar con exactitud sin una implementación de referencia paso a paso.
    // Nos enfocaremos en la forma y en que no falle. La librería subyacente está probada.
    test('debería calcular EMA y devolver un array de la longitud correcta', () => {
      const ema5 = indicators.calculateEMA(closePrices, 5);
      expect(ema5).toBeInstanceOf(Array);
      // technicalindicators ema devuelve N-P+1 resultados, igual que SMA.
      expect(ema5.length).toBe(closePrices.length - 5 + 1);
      expect(typeof ema5[0]).toBe('number');
    });
    test('debería devolver null si no hay suficientes datos para EMA', () => {
      expect(indicators.calculateEMA(closePrices.slice(0, 3), 5)).toBeNull();
    });
  });

  describe('calculateRSI', () => {
    // RSI necesita P+1 datos para el primer valor, y la librería technicalindicators devuelve N-P puntos.
    test('debería calcular RSI y devolver un array de la longitud correcta', () => {
      const rsi14 = indicators.calculateRSI(closePrices, 14); // Necesita 14 datos
      expect(rsi14).toBeInstanceOf(Array);
      expect(rsi14.length).toBe(closePrices.length - 14);
      if (rsi14.length > 0) {
        expect(typeof rsi14[0]).toBe('number');
        expect(rsi14[0]).toBeGreaterThanOrEqual(0);
        expect(rsi14[0]).toBeLessThanOrEqual(100);
      }
    });
     test('debería devolver null si no hay suficientes datos para RSI', () => {
      expect(indicators.calculateRSI(closePrices.slice(0, 13), 14)).toBeNull(); // Solo 13 datos
    });
  });

  describe('calculateMACD', () => {
    // MACD (12,26,9) necesita al menos 26+9-1 = 34 puntos para un resultado completo.
    // La librería devuelve N - (slowPeriod + signalPeriod - 1) + 1 puntos.
    // O más bien, N - slowPeriod - signalPeriod + 2 si se cuenta desde el inicio.
    // Para nuestro dataset de 16 puntos, MACD(12,26,9) no dará resultados.
    // Usemos periodos más cortos para prueba.
    const shortMACDParams = { fastPeriod: 3, slowPeriod: 6, signalPeriod: 2 }; // Necesita 6+2-1 = 7 puntos
    // La librería devuelve N - (slow + signal - 2) para MACD.
    // N - FBL + 1, donde FBL = slow + signal -1
    // N - slow - signal + 2 = 16 - 6 - 2 + 2 = 10
    test('debería calcular MACD y devolver un array de objetos', () => {
      const macd = indicators.calculateMACD(closePrices, shortMACDParams);
      expect(macd).toBeInstanceOf(Array);
      expect(macd.length).toBe(closePrices.length - shortMACDParams.slowPeriod - shortMACDParams.signalPeriod + 2);
      if (macd.length > 0) {
        expect(macd[0]).toHaveProperty('MACD');
        expect(macd[0]).toHaveProperty('signal');
        expect(macd[0]).toHaveProperty('histogram');
        expect(typeof macd[0].MACD).toBe('number');
      }
    });
    test('debería devolver null si no hay suficientes datos para MACD', () => {
      expect(indicators.calculateMACD(closePrices.slice(0, 5), shortMACDParams)).toBeNull(); // Solo 5 datos, necesita 7
    });
  });

  describe('calculateATR', () => {
    // ATR(P) necesita P klines, devuelve N-P+1 puntos.
    test('debería calcular ATR y devolver un array de la longitud correcta', () => {
      const atr5 = indicators.calculateATR(sampleKlines, 5);
      expect(atr5).toBeInstanceOf(Array);
      expect(atr5.length).toBe(sampleKlines.length - 5 + 1);
      if (atr5.length > 0) {
        expect(typeof atr5[0]).toBe('number');
        expect(atr5[0]).toBeGreaterThan(0); // ATR debe ser positivo
      }
    });
    test('debería devolver null si no hay suficientes datos para ATR (klines)', () => {
      expect(indicators.calculateATR(sampleKlines.slice(0,3), 5)).toBeNull();
    });
     test('debería devolver null si la entrada klines es inválida', () => {
      expect(indicators.calculateATR([], 5)).toBeNull();
      expect(indicators.calculateATR(null, 5)).toBeNull();
    });
  });

});
