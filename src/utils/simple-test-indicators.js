// simple-test-indicators.js
const indicators = require('./indicators');
const logger = require('./logger'); // Asumiendo que el logger está en el mismo dir que indicators

async function runTest() {
  logger.info('[TestIndicators] Iniciando prueba simple de indicadores...');
  const sampleKlines = Array.from({length: 100}, (_, i) => ({
    openTime: Date.now() + i * 1000,
    open: 100 + Math.sin(i / 10) * 10,
    high: 100 + Math.sin(i / 10) * 10 + Math.random()*2,
    low: 100 + Math.sin(i / 10) * 10 - Math.random()*2,
    close: 100 + Math.sin(i / 10) * 10 + (Math.random() - 0.5) * 2, // Precio de cierre con algo de ruido
    volume: 1000 + Math.random() * 500,
    closeTime: Date.now() + (i+1) * 1000 -1,
    quoteAssetVolume: (100 + Math.sin(i / 10) * 10) * (1000 + Math.random() * 500),
    numberOfTrades: 10 + Math.floor(Math.random()*10),
    takerBuyBaseAssetVolume: 500 + Math.random() * 250,
    takerBuyQuoteAssetVolume: (100 + Math.sin(i / 10) * 10) * (500 + Math.random() * 250)
  }));

  const closes = indicators.getClosePrices(sampleKlines);
  if (closes.length === 0) {
    logger.error('[TestIndicators] No se pudieron obtener precios de cierre.');
    return;
  }
  logger.info(`[TestIndicators] Obtenidos ${closes.length} precios de cierre. Últimos 5: ${closes.slice(-5).map(p => p.toFixed(2)).join(', ')}`);

  const sma5 = indicators.calculateSMA(closes, 5);
  if (sma5) logger.info(`[TestIndicators] SMA(5) - ${sma5.length} valores. Último: ${sma5[sma5.length-1]?.toFixed(2)}`);
  else logger.warn('[TestIndicators] SMA(5) no pudo ser calculado.');

  const ema10 = indicators.calculateEMA(closes, 10);
  if (ema10) logger.info(`[TestIndicators] EMA(10) - ${ema10.length} valores. Último: ${ema10[ema10.length-1]?.toFixed(2)}`);
  else logger.warn('[TestIndicators] EMA(10) no pudo ser calculado.');

  const rsi14 = indicators.calculateRSI(closes, 14);
  if (rsi14) logger.info(`[TestIndicators] RSI(14) - ${rsi14.length} valores. Último: ${rsi14[rsi14.length-1]?.toFixed(2)}`);
  else logger.warn('[TestIndicators] RSI(14) no pudo ser calculado.');

  const macdDefault = indicators.calculateMACD(closes);
  if (macdDefault && macdDefault.length > 0) {
    const lastMacd = macdDefault[macdDefault.length-1];
    logger.info(`[TestIndicators] MACD(default) - ${macdDefault.length} valores. Último: MACD=${lastMacd.MACD?.toFixed(2)}, Signal=${lastMacd.signal?.toFixed(2)}, Hist=${lastMacd.histogram?.toFixed(2)}`);
  } else {
    logger.warn('[TestIndicators] MACD(default) no pudo ser calculado o devolvió array vacío.');
  }

  const atr14 = indicators.calculateATR(sampleKlines, 14);
  if (atr14) logger.info(`[TestIndicators] ATR(14) - ${atr14.length} valores. Último: ${atr14[atr14.length-1]?.toFixed(4)}`); // ATR puede tener más decimales
  else logger.warn("[TestIndicators] ATR(14) no pudo ser calculado.");

  // Prueba con pocos datos
  logger.info('\n[TestIndicators] Probando con datos insuficientes (10 puntos):');
  const fewCloses = closes.slice(0, 10);
  const sma20_few = indicators.calculateSMA(fewCloses, 20); // Debería ser null
  if (sma20_few === null) logger.info('[TestIndicators] SMA(20) con 10 datos: null (correcto)');
  else logger.error(`[TestIndicators] SMA(20) con 10 datos: ${sma20_few} (incorrecto, debería ser null)`);

  logger.info('\n[TestIndicators] Prueba simple de indicadores completada.');
}

// Ejecutar la prueba si el logger está disponible
if (logger && typeof logger.info === 'function') {
    runTest().catch(e => logger.error('[TestIndicators] Error en runTest:', e));
} else {
    console.log('Logger no disponible, saltando runTest en simple-test-indicators.js');
}
