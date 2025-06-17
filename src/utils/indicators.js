const TA = require('technicalindicators');
const logger = require('./logger'); // Asumiendo que logger.js está en el mismo directorio o ajustar ruta

// Helper para extraer precios de cierre de datos de klines (velas)
// Asume que klines es un array de objetos con una propiedad 'close'
// Ejemplo de kline de BinanceService: { openTime, open, high, low, close, volume, ... }
function getClosePrices(klines) {
  if (!Array.isArray(klines) || klines.length === 0) {
    // logger.warn('[Indicators] Datos de klines vacíos o inválidos para extraer precios de cierre.');
    return [];
  }
  return klines.map(k => k.close);
}

// Helper para validar que hay suficientes datos para el período del indicador
function hasEnoughData(dataLength, period, indicatorName) {
  if (dataLength < period) {
    // logger.warn(`[Indicators] No hay suficientes datos (${dataLength}) para calcular ${indicatorName} con período ${period}. Se necesitan al menos ${period} puntos.`);
    return false;
  }
  return true;
}

/**
 * Calcula la Media Móvil Simple (SMA).
 * @param {number[]} closePrices Array de precios de cierre.
 * @param {number} period Período para la SMA (ej. 20).
 * @returns {number[] | null} Array con los valores de la SMA, o null si no hay suficientes datos.
 */
function calculateSMA(closePrices, period) {
  if (!hasEnoughData(closePrices.length, period, 'SMA')) return null;
  try {
    return TA.sma({ period, values: closePrices });
  } catch (error) {
    logger.error('[Indicators] Error al calcular SMA:', { error: error.message, period });
    return null;
  }
}

/**
 * Calcula la Media Móvil Exponencial (EMA).
 * @param {number[]} closePrices Array de precios de cierre.
 * @param {number} period Período para la EMA (ej. 20).
 * @returns {number[] | null} Array con los valores de la EMA, o null si no hay suficientes datos.
 */
function calculateEMA(closePrices, period) {
  if (!hasEnoughData(closePrices.length, period, 'EMA')) return null;
  try {
    return TA.ema({ period, values: closePrices });
  } catch (error) {
    logger.error('[Indicators] Error al calcular EMA:', { error: error.message, period });
    return null;
  }
}

/**
 * Calcula el Índice de Fuerza Relativa (RSI).
 * @param {number[]} closePrices Array de precios de cierre.
 * @param {number} period Período para el RSI (ej. 14).
 * @returns {number[] | null} Array con los valores del RSI, o null si no hay suficientes datos.
 */
function calculateRSI(closePrices, period) {
  if (!hasEnoughData(closePrices.length, period, 'RSI')) return null;
  // RSI típicamente necesita al menos 'period + 1' datos para dar el primer valor,
  // y la librería puede manejar internamente el 'warm-up'.
  // La librería technicalindicators maneja el 'warm-up' y devuelve menos puntos que la entrada si es necesario.
  try {
    return TA.rsi({ period, values: closePrices });
  } catch (error) {
    logger.error('[Indicators] Error al calcular RSI:', { error: error.message, period });
    return null;
  }
}

/**
 * Calcula la Convergencia/Divergencia de Medias Móviles (MACD).
 * @param {number[]} closePrices Array de precios de cierre.
 * @param {object} params Parámetros para MACD.
 * @param {number} params.fastPeriod Período rápido (ej. 12).
 * @param {number} params.slowPeriod Período lento (ej. 26).
 * @param {number} params.signalPeriod Período de la señal (ej. 9).
 * @returns {object[] | null} Array de objetos { MACD, signal, histogram }, o null si no hay suficientes datos.
 *                            Ejemplo: [{ MACD: 1.56, signal: 1.20, histogram: 0.36}, ...]
 */
function calculateMACD(closePrices, params = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }) {
  const { fastPeriod, slowPeriod, signalPeriod } = params;
  // MACD necesita suficientes datos para la EMA más lenta + el período de la señal.
  // La librería technicalindicators se encarga de esto.
  // El número mínimo de puntos necesarios es slowPeriod + signalPeriod -1 para obtener el primer set completo.
  if (!hasEnoughData(closePrices.length, slowPeriod + signalPeriod -1, 'MACD')) return null;

  try {
    const macdInput = {
      values: closePrices,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false, // Usar EMA para el oscilador (estándar)
      SimpleMASignal: false,   // Usar EMA para la línea de señal (estándar)
    };
    return TA.macd(macdInput);
  } catch (error) {
    logger.error('[Indicators] Error al calcular MACD:', { error: error.message, params });
    return null;
  }
}

module.exports = {
  getClosePrices, // Exportar el helper por si es útil externamente
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateATR, // <--- AÑADIDO ATR
};

/**
 * Calcula el Average True Range (ATR).
 * @param {object[]} klines Array de objetos de velas, cada uno con high, low, close.
 * @param {number} period Período para el ATR (ej. 14).
 * @returns {number[] | null} Array con los valores del ATR, o null si no hay suficientes datos.
 */
function calculateATR(klines, period) {
  if (!Array.isArray(klines) || klines.length === 0) {
    logger.warn('[Indicators] Datos de klines vacíos o inválidos para ATR.');
    return null;
  }
  // ATR necesita al menos 'period' datos para el primer valor, la librería maneja el warm-up.
  if (klines.length < period) {
     logger.warn(`[Indicators] No hay suficientes datos (${klines.length}) para calcular ATR con período ${period}. Se necesitan al menos ${period} klines.`);
    return null;
  }

  const highPrices = klines.map(k => k.high);
  const lowPrices = klines.map(k => k.low);
  const closePrices = klines.map(k => k.close);

  try {
    const atrInput = {
      high: highPrices,
      low: lowPrices,
      close: closePrices,
      period: period
    };
    return TA.atr(atrInput);
  } catch (error) {
    logger.error('[Indicators] Error al calcular ATR:', { error: error.message, period });
    return null;
  }
}

// Ejemplo de uso (comentar o quitar para producción):
// (async () => {
//   // Simular datos de klines (los que daría BinanceService.getKlines)
//   const sampleKlines = Array.from({length: 50}, (_, i) => ({ close: 100 + Math.sin(i / 5) * 10 + Math.random() * 2 }));
//   const closes = getClosePrices(sampleKlines);
//   if (closes.length > 0) {
//     logger.info('[Indicators] Ejemplo - Precios de cierre:', closes.slice(-5));
//
//     const sma20 = calculateSMA(closes, 20);
//     if (sma20) logger.info('[Indicators] Ejemplo - SMA(20) último valor:', sma20[sma20.length -1]);
//
//     const ema10 = calculateEMA(closes, 10);
//     if (ema10) logger.info('[Indicators] Ejemplo - EMA(10) último valor:', ema10[ema10.length -1]);
//
//     const rsi14 = calculateRSI(closes, 14);
//     if (rsi14) logger.info('[Indicators] Ejemplo - RSI(14) último valor:', rsi14[rsi14.length -1]);
//
//     const macdResult = calculateMACD(closes); // Usando defaults
//     if (macdResult && macdResult.length > 0) {
//       logger.info('[Indicators] Ejemplo - MACD último valor:', macdResult[macdResult.length -1]);
//     }
//
//     const macdCustom = calculateMACD(closes, { fastPeriod: 8, slowPeriod: 21, signalPeriod: 5 });
//     if (macdCustom && macdCustom.length > 0) {
//       logger.info('[Indicators] Ejemplo - MACD(8,21,5) último valor:', macdCustom[macdCustom.length -1]);
//     }
//   }
// })();
