const db = require('../database/db');
const BinanceService = require('./BinanceService');
const AIService = require('./AIService');
const indicatorsUtil = require('../utils/indicators'); // Renombrado para evitar colisión de nombre 'indicators'
const logger =require('../utils/logger');

// Variable para controlar el bucle de trading (para un futuro control de start/stop)
let isTradingLoopActive = false;
let tradingLoopIntervalId = null;

/**
 * Obtiene los pares de trading activos desde la base de datos.
 */
async function getActiveTradingPairs() {
  try {
    const { rows } = await db.query("SELECT * FROM trading_pairs WHERE is_active = TRUE");
    return rows;
  } catch (error) {
    logger.error('[TradingService] Error al obtener pares de trading activos:', { error: error.message });
    return [];
  }
}

/**
 * Obtiene la configuración específica para un par de trading.
 * (Ej. qué indicadores usar, parámetros de IA específicos, modo Spot/Margin)
 * Por ahora, esto es un placeholder. Se podría expandir la tabla trading_pairs
 * o tener una tabla de configuración de estrategia por par.
 */
async function getPairStrategyConfig(pairSymbol) {
  // Placeholder: Devolver una configuración por defecto.
  // En el futuro, leer esto de la DB.
  return {
    klinesInterval: '1h',
    klinesLimit: 100,
    indicators: [
      { name: 'SMA', period: 20 },
      { name: 'EMA', period: 50 },
      { name: 'RSI', period: 14 },
      { name: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }
    ],
    riskParams: { // Risk params se detallarán más en Paso 13
      maxAllowedLossPerTrade: 2, // % (conceptual, se usa stopLossPercentage)
      minRiskBenefitRatio: 1.5,
      defaultTradeAmountUSD: 100,
      useVolatilityCheck: true, // NUEVO
      atrPeriod: 14, // NUEVO - Periodo para ATR
      maxAllowedATRPercentageOfPrice: 3.0, // NUEVO - Si ATR > 3% del precio, considerar alta volatilidad
    },
    orderStrategy: { // Nuevas configuraciones para órdenes inteligentes
      defaultOrderType: 'MARKET', // 'MARKET', 'LIMIT'
      limitOrderOffsetPercentage: 0.1, // % del precio actual para offset de orden LIMIT
      useOCO: false, // Usar OCO para SL/TP
      useStopLoss: true,
      stopLossType: 'STOP_LOSS_LIMIT', // 'STOP_LOSS_LIMIT' o podria ser parte de OCO
      stopLossPercentage: 1.5, // % de offset para el stopPrice
      stopLossLimitOffsetPercentage: 0.05, // % de offset desde stopPrice para el precio límite del SLL
      useTakeProfit: true,
      takeProfitType: 'TAKE_PROFIT_LIMIT', // 'TAKE_PROFIT_LIMIT' o parte de OCO
      takeProfitPercentage: 3.0, // % de offset para el takeProfit (stopPrice del TPL)
      takeProfitLimitOffsetPercentage: 0.05, // % de offset desde takeProfitPrice para el precio límite del TPL
    },
    aiOptions: { model: 'gpt-3.5-turbo', temperature: 0.7 },
    tradeMode: 'SPOT', // Se ajustará según trading_pairs.margin_enabled
  };
}

/**
 * Procesa un solo ciclo de trading para un par específico.
 * @param {object} pair - El objeto del par de trading desde la DB (tabla trading_pairs).
 */
async function processTradingPair(pair) {
  logger.info(`[TradingService] Procesando par: ${pair.symbol}`);

  try {
    const strategyConfig = await getPairStrategyConfig(pair.symbol);
    const tradeMode = pair.margin_enabled ? 'MARGIN' : 'SPOT'; // Determinar modo basado en DB

    // 1. Obtener datos de mercado
    const klines = await BinanceService.getKlines(pair.symbol, strategyConfig.klinesInterval, strategyConfig.klinesLimit);
    if (!klines || klines.length < strategyConfig.klinesLimit) {
      logger.warn(`[TradingService] Datos de klines insuficientes para ${pair.symbol}. Saltando ciclo.`);
      return;
    }
    const ticker = await BinanceService.getTicker(pair.symbol);
    // const depth = await BinanceService.getDepth(pair.symbol); // Opcional, si la IA lo usa

    const marketData = {
      klines,
      klinesInterval: strategyConfig.klinesInterval,
      ticker,
      // depth,
    };

    // 2. Calcular indicadores técnicos
    const closePrices = indicatorsUtil.getClosePrices(klines);
    const calculatedIndicators = {};
    for (const indConfig of strategyConfig.indicators) {
      switch (indConfig.name) {
        case 'SMA':
          calculatedIndicators.sma = indicatorsUtil.calculateSMA(closePrices, indConfig.period);
          calculatedIndicators.smaPeriod = indConfig.period;
          break;
        case 'EMA':
          calculatedIndicators.ema = indicatorsUtil.calculateEMA(closePrices, indConfig.period);
          calculatedIndicators.emaPeriod = indConfig.period;
          break;
        case 'RSI':
          calculatedIndicators.rsi = indicatorsUtil.calculateRSI(closePrices, indConfig.period);
          calculatedIndicators.rsiPeriod = indConfig.period;
          break;
        case 'MACD':
          calculatedIndicators.macd = indicatorsUtil.calculateMACD(closePrices, indConfig.params);
          calculatedIndicators.macdParams = indConfig.params;
          break;
      }
    }
    // logger.debug(`[TradingService] Indicadores para ${pair.symbol}:`, calculatedIndicators);

    // Calcular ATR y realizar chequeo de volatilidad
    const atrPeriod = strategyConfig.riskParams.atrPeriod || 14;
    const atrValues = indicatorsUtil.calculateATR(klines, atrPeriod);
    let lastATR = null;
    if (atrValues && atrValues.length > 0) {
      lastATR = atrValues[atrValues.length - 1];
      calculatedIndicators.atr = lastATR; // Añadir a indicadores para el prompt y logging
      if (marketData.ticker && marketData.ticker.price) {
          logger.info(`[TradingService] ${pair.symbol}: ATR(${atrPeriod}) calculado: ${lastATR.toFixed(pair.price_precision || 5)}`); // Usar price_precision del par
          if (strategyConfig.riskParams.useVolatilityCheck) {
            const currentPriceForATRCheck = parseFloat(marketData.ticker.price);
            const atrPercentageOfPrice = (lastATR / currentPriceForATRCheck) * 100;
            logger.info(`[TradingService] ${pair.symbol}: Volatilidad ATR: ${atrPercentageOfPrice.toFixed(2)}% del precio actual.`);
            if (atrPercentageOfPrice > strategyConfig.riskParams.maxAllowedATRPercentageOfPrice) {
              logger.warn(`[TradingService] ${pair.symbol}: Alta volatilidad detectada (${atrPercentageOfPrice.toFixed(2)}% > ${strategyConfig.riskParams.maxAllowedATRPercentageOfPrice}%). Saltando ciclo de trading para este par.`);
              return; // Saltar este par
            }
          }
      } else { logger.warn(`[TradingService] ${pair.symbol}: No hay datos de ticker.price para el chequeo de volatilidad ATR.`); }
    } else { logger.warn(`[TradingService] ${pair.symbol}: No se pudo calcular ATR.`); }


    // 3. Preparar contexto para la IA (incluyendo parámetros de riesgo y cuenta)
    // TODO: Obtener información de cuenta relevante (balances, posiciones abiertas para este par)
    //       y parámetros de riesgo más detallados de la DB (Paso 13).
    const accountInfo = { /* availableBalanceQuote: ..., currentPosition: ... */ };
    // Simulación de info de cuenta (se debe obtener de BinanceService)
    // const balances = await BinanceService.getAccountBalances();
    // const quoteAssetBalance = balances.find(b => b.asset === pair.quote_asset);
    // accountInfo.availableBalanceQuote = quoteAssetBalance ? parseFloat(quoteAssetBalance.free) : 0;
    // ... obtener posición actual si existe ...


    const promptContext = {
      symbol: pair.symbol,
      marketData,
      indicators: calculatedIndicators,
      riskParams: strategyConfig.riskParams, // Placeholder
      accountInfo, // Placeholder
      strategyHint: 'general_crypto_TA', // Placeholder
    };

    // 4. Llamar a AIService.getTradingDecision()
    const aiDecisionResult = await AIService.getTradingDecision(promptContext, pair.id);

    if (!aiDecisionResult || !aiDecisionResult.decision) {
      logger.warn(`[TradingService] No se pudo obtener una decisión de IA válida para ${pair.symbol}. Saltando.`);
      return;
    }

    const { decision, reason, modelUsed } = aiDecisionResult;
    logger.info(`[TradingService] Decisión de IA para ${pair.symbol}: ${decision} (${reason}) usando ${modelUsed}`);

    // 5. Ejecutar orden basada en la decisión
    // Esta lógica es simplificada. Necesita más detalles: tamaño de orden, precio exacto para LIMIT,
    // gestión de errores de orden, etc.
    if (decision === 'BUY' || decision === 'SELL') {
      const orderStrategy = strategyConfig.orderStrategy;
      const currentPrice = parseFloat(marketData.ticker.price);
      let orderType = orderStrategy.defaultOrderType.toUpperCase();
      let calculatedPrice = null; // Precio para orden LIMIT
      let stopPrice = null; // stopPrice para STOP_LOSS_LIMIT o TAKE_PROFIT_LIMIT
      let orderOptions = {};

      // Calcular cantidad base (esto necesita refinamiento con gestión de riesgo)
      let quantity = strategyConfig.riskParams.defaultTradeAmountUSD / currentPrice;
      if (quantity < pair.min_trade_size || quantity > pair.max_trade_size) {
        logger.warn(`[TradingService] Cantidad calculada (${quantity}) para ${pair.symbol} fuera de límites. Saltando orden.`);
        return;
      }
      const adjustedQuantity = Math.floor(quantity / pair.step_size) * pair.step_size;
      if (adjustedQuantity <= 0) {
        logger.warn(`[TradingService] Cantidad ajustada (${adjustedQuantity}) para ${pair.symbol} es <= 0. Saltando orden.`);
        return;
      }

      logger.info(`[TradingService] ${pair.symbol}: Decisión ${decision}. Cantidad base: ${adjustedQuantity}. Precio actual: ${currentPrice}.`);

      // Lógica para OCO (si está habilitada y se usa SL y TP)
      if (orderStrategy.useOCO && orderStrategy.useStopLoss && orderStrategy.useTakeProfit) {
        logger.info(`[TradingService] ${pair.symbol}: Preparando orden OCO.`);
        let ocoPrice, ocoStopPrice, ocoStopLimitPrice, ocoTakeProfitPrice, ocoTakeProfitLimitPrice;

        // Parte Take Profit de OCO (es una orden LIMIT)
        ocoTakeProfitPrice = (decision === 'BUY') ? currentPrice * (1 + orderStrategy.takeProfitPercentage / 100) : currentPrice * (1 - orderStrategy.takeProfitPercentage / 100);
        ocoTakeProfitPrice = parseFloat(ocoTakeProfitPrice.toFixed(pair.tick_size_decimals || 8)); // Ajustar a tick_size

        // Parte Stop Loss de OCO (es una orden STOP_LOSS_LIMIT)
        ocoStopPrice = (decision === 'BUY') ? currentPrice * (1 - orderStrategy.stopLossPercentage / 100) : currentPrice * (1 + orderStrategy.stopLossPercentage / 100);
        ocoStopPrice = parseFloat(ocoStopPrice.toFixed(pair.tick_size_decimals || 8));
        ocoStopLimitPrice = (decision === 'BUY') ? ocoStopPrice * (1 - orderStrategy.stopLossLimitOffsetPercentage / 100) : ocoStopPrice * (1 + orderStrategy.stopLossLimitOffsetPercentage / 100);
        ocoStopLimitPrice = parseFloat(ocoStopLimitPrice.toFixed(pair.tick_size_decimals || 8));

        // 'price' para ocoOrder es el precio de la orden Limit (take profit)
        // 'stopPrice' es el trigger de la orden StopLimit
        // 'stopLimitPrice' es el precio límite de la orden StopLimit
        // La orden principal (LIMIT o MARKET) se coloca primero, luego OCO para SL/TP (esto es un error de concepto)
        // NO, OCO coloca una orden LIMIT y una STOP_LOSS_LIMIT simultáneamente.
        // Si la IA sugiere un precio de entrada (LIMIT), la orden OCO no es para la entrada principal.
        // OCO se usa para poner un TP y un SL para una POSICIÓN EXISTENTE o una orden de entrada LIMIT.
        // Por ahora, si es OCO, asumimos que la orden de entrada es MARKET o LIMIT, y OCO es para SL/TP después.
        // ESTA LÓGICA DE OCO PARA ENTRADA ES COMPLEJA. Simplificamos: si useOCO=true, la orden principal es LIMIT/MARKET
        // y LUEGO se intentaría colocar una OCO para SL/TP si la orden principal se llena. Esto es aún más complejo.
        // Por simplicidad AHORA: si useOCO es true, la orden que se coloca es una OCO donde 'price' es TP y 'stopPrice' + 'stopLimitPrice' es SL.
        // Esto significa que la orden de entrada y el SL/TP se colocan en una sola operación OCO.
        // PERO la API de Binance OCO es para colocar un par de órdenes donde una cancela la otra; una es LIMIT y la otra es STOP_LOSS_LIMIT.
        // Típicamente, la LIMIT es la orden de toma de ganancias y la STOP_LOSS_LIMIT es la de stop loss.
        // Esto es para una POSICIÓN que YA TIENES o para una orden de ENTRADA de tipo LIMIT.

        // Si la estrategia es entrar con OCO (ej. un Limit de compra + un Stop-Limit de compra por si rompe hacia arriba), es diferente.
        // Asumamos que la OCO aquí es para SALIR de una posición (TP y SL)."
        // Por lo tanto, la orden de ENTRADA se hace primero, y luego si se llena, se pone una OCO.
        // ESTO CAMBIA EL FLUJO. Por ahora, mantendremos la lógica de órdenes de entrada simples y dejaremos OCO para más tarde o para gestión de posiciones abiertas.
        logger.warn('[TradingService] La lógica completa de OCO para entradas y SL/TP simultáneo se refinará. Por ahora, se priorizarán órdenes de entrada simples con SL/TP separados si es necesario.');
        // --- FIN LÓGICA OCO (SIMPLIFICADA/PENDIENTE) ---
      }

      // Lógica para órdenes de entrada (LIMIT, MARKET) y SL/TP separados (si OCO no se usa o falla)
      if (orderType === 'LIMIT') {
        calculatedPrice = (decision === 'BUY') ? currentPrice * (1 - orderStrategy.limitOrderOffsetPercentage / 100) : currentPrice * (1 + orderStrategy.limitOrderOffsetPercentage / 100);
        calculatedPrice = parseFloat(calculatedPrice.toFixed(pair.tick_size_decimals || 8)); // Ajustar a tick_size
        orderOptions.price = calculatedPrice;
      }

      if (orderStrategy.useStopLoss && orderType !== 'STOP_LOSS_LIMIT') { // No añadir si la orden principal ya es SLL
        // Si no es OCO, y se usa SL, la orden principal es MARKET/LIMIT, y SL es una orden separada (STOP_LOSS_LIMIT)
        // Esto es si la orden principal es la de entrada. El SL se pondría DESPUÉS de que se llene.
        // O, si la orden de entrada es STOP_LOSS_LIMIT (ej. breakout entry)
        if (orderStrategy.stopLossType === 'STOP_LOSS_LIMIT' && orderType !== 'MARKET' && orderType !== 'LIMIT') { // Si la orden de ENTRADA es SLL
            orderType = 'STOP_LOSS_LIMIT';
            stopPrice = (decision === 'BUY') ? currentPrice * (1 + orderStrategy.stopLossPercentage / 100) : currentPrice * (1 - orderStrategy.stopLossPercentage / 100); // Para breakout BUY por encima, SELL por debajo
            stopPrice = parseFloat(stopPrice.toFixed(pair.tick_size_decimals || 8));
            calculatedPrice = (decision === 'BUY') ? stopPrice * (1 + orderStrategy.stopLossLimitOffsetPercentage / 100) : stopPrice * (1 - orderStrategy.stopLossLimitOffsetPercentage / 100);
            calculatedPrice = parseFloat(calculatedPrice.toFixed(pair.tick_size_decimals || 8));
            orderOptions.stopPrice = stopPrice;
            orderOptions.price = calculatedPrice;
        } else {
            logger.info('[TradingService] SL configurado, pero se colocará después de que la orden de entrada se llene (lógica pendiente).');
        }
      }
      // Lógica similar para Take Profit (TPL) como orden de entrada o posterior.

      orderOptions.type = orderType; // Pasar el tipo de orden a las opciones para BinanceService

      // Chequeo de Riesgo-Beneficio (R:R)
      const { stopLossPercentage, takeProfitPercentage, useStopLoss, useTakeProfit } = strategyConfig.orderStrategy;
      const minRR = strategyConfig.riskParams.minRiskBenefitRatio;

      if (useStopLoss && stopLossPercentage > 0 && useTakeProfit && takeProfitPercentage > 0 && minRR > 0) {
        let entryPriceForRR = currentPrice; // Asumir precio actual para MARKET o si calculatedPrice no está listo
        if (orderType === 'LIMIT' && calculatedPrice) {
          entryPriceForRR = calculatedPrice;
        } else if (orderType === 'STOP_LOSS_LIMIT' && orderOptions.price) { // Si la entrada es SLL, el precio de entrada es el 'price' de SLL
          entryPriceForRR = orderOptions.price;
        }

        const slPrice = (decision === 'BUY') ? entryPriceForRR * (1 - stopLossPercentage / 100) : entryPriceForRR * (1 + stopLossPercentage / 100);
        const tpPrice = (decision === 'BUY') ? entryPriceForRR * (1 + takeProfitPercentage / 100) : entryPriceForRR * (1 - takeProfitPercentage / 100);

        let potentialRisk = 0; let potentialReward = 0;
        if (decision === 'BUY') {
          potentialRisk = entryPriceForRR - slPrice;
          potentialReward = tpPrice - entryPriceForRR;
        } else { // SELL
          potentialRisk = slPrice - entryPriceForRR;
          potentialReward = entryPriceForRR - tpPrice;
        }

        // Asegurar que los precios de SL/TP no crucen el precio de entrada de forma ilógica (ej. SL > entrada para BUY)
        if ((decision === 'BUY' && (slPrice >= entryPriceForRR || tpPrice <= entryPriceForRR)) ||
            (decision === 'SELL' && (slPrice <= entryPriceForRR || tpPrice >= entryPriceForRR))) {
           logger.warn(`[TradingService] ${pair.symbol}: Configuración de SL (${slPrice.toFixed(pair.price_precision || 5)}) / TP (${tpPrice.toFixed(pair.price_precision || 5)}) inválida respecto al precio de entrada (${entryPriceForRR.toFixed(pair.price_precision || 5)}). Saltando chequeo R:R y orden.`);
           return;
        }

        if (potentialRisk <= 0 || potentialReward <= 0) { // Risk debe ser positivo
          logger.warn(`[TradingService] ${pair.symbol}: Riesgo (${potentialRisk.toFixed(pair.price_precision || 5)}) o Recompensa (${potentialReward.toFixed(pair.price_precision || 5)}) no son positivos. SL/TP mal configurado o muy cercano. Saltando orden.`);
          return;
        }

        const calculatedRR = potentialReward / potentialRisk;
        logger.info(`[TradingService] ${pair.symbol}: Chequeo R:R - Entrada: ${entryPriceForRR.toFixed(pair.price_precision || 5)}, SL: ${slPrice.toFixed(pair.price_precision || 5)}, TP: ${tpPrice.toFixed(pair.price_precision || 5)}`);
        logger.info(`[TradingService] ${pair.symbol}: R:R Calculado: ${calculatedRR.toFixed(2)} (Requerido: >${minRR})`);

        if (calculatedRR < minRR) {
          logger.warn(`[TradingService] ${pair.symbol}: R:R (${calculatedRR.toFixed(2)}) es menor que el mínimo requerido (${minRR}). Saltando orden.`);
          return;
        }
      } else {
        logger.info(`[TradingService] ${pair.symbol}: Chequeo R:R no aplicable (SL/TP no habilitados, porcentajes no positivos o minRR no positivo).`);
      }

      logger.info(`[TradingService] Preparando orden ${orderType} ${decision} para ${adjustedQuantity} ${pair.base_asset} en ${pair.symbol} (${tradeMode})`);
      if (calculatedPrice) logger.info(`  Precio Límite: ${calculatedPrice}`);
      if (orderOptions.stopPrice) logger.info(`  Precio Stop: ${orderOptions.stopPrice}`);
      if (Object.keys(orderOptions).length > 0) logger.info(`  Opciones: ${JSON.stringify(orderOptions)}`);

      let orderResult = null;
      try {
        if (tradeMode === 'SPOT') {
          orderResult = await BinanceService.createSpotOrder(pair.symbol, decision, orderType, adjustedQuantity, calculatedPrice, orderOptions);
        } else if (tradeMode === 'MARGIN') {
          orderResult = await BinanceService.createMarginOrder(pair.symbol, decision, orderType, adjustedQuantity, calculatedPrice, { ...orderOptions, isIsolated: pair.margin_is_isolated || 'FALSE' });
        }

        if (orderResult && orderResult.orderId) {
          logger.info(`[TradingService] Orden (${orderType}) ejecutada para ${pair.symbol}: ID ${orderResult.orderId}, Estado ${orderResult.status}`);
          // Registrar transacción (código existente)
          await db.query(
            `INSERT INTO transactions (pair_id, binance_order_id, client_order_id, type, mode, price, quantity, total_value, status, executed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              pair.id,
              orderResult.orderId,
              orderResult.clientOrderId,
              decision, // 'BUY' o 'SELL'
              tradeMode,
              parseFloat(orderResult.fills && orderResult.fills.length > 0 ? orderResult.fills[0].price : orderResult.price) || 0, // Precio de ejecución o precio límite
              parseFloat(orderResult.executedQty),
              parseFloat(orderResult.cummulativeQuoteQty),
              orderResult.status,
              new Date(orderResult.transactTime || orderResult.updateTime || Date.now())
            ]
          );
          logger.info(`[TradingService] Transacción registrada en DB para orden ID ${orderResult.orderId}`);
        } else {
          logger.warn(`[TradingService] La orden para ${pair.symbol} no parece haberse ejecutado correctamente o no devolvió orderId.`, orderResult);
        }
      } catch (orderError) {
        logger.error(`[TradingService] Error al ejecutar orden ${decision} para ${pair.symbol}:`, { error: orderError.message });
      }
    } else if (decision === 'HOLD' || decision === 'NO_ACTION') {
      logger.info(`[TradingService] Decisión para ${pair.symbol}: ${decision}. No se ejecuta orden.`);
    }

  } catch (error) {
    logger.error(`[TradingService] Error fatal al procesar el par ${pair.symbol}:`, { error: error.message, stack: error.stack });
  }
}

/**
 * Bucle principal de trading. Se ejecuta a intervalos regulares.
 */
async function tradingTick() {
  logger.info('[TradingService] Iniciando tick de trading...');
  const activePairs = await getActiveTradingPairs();
  if (activePairs.length === 0) {
    logger.info('[TradingService] No hay pares de trading activos configurados.');
    return;
  }

  for (const pair of activePairs) {
    if (!isTradingLoopActive) { // Verificar antes de procesar cada par si el bucle fue detenido
        logger.info('[TradingService] Bucle de trading detenido. Finalizando tick actual.');
        break;
    }
    await processTradingPair(pair);
  }
  logger.info('[TradingService] Tick de trading completado.');
}

/**
 * Inicia el bucle de trading.
 * @param {number} intervalMs - Intervalo en milisegundos para cada tick. Default 60000 (1 minuto).
 */
function startTradingLoop(intervalMs = 60000) {
  if (isTradingLoopActive) {
    logger.warn('[TradingService] El bucle de trading ya está activo.');
    return;
  }
  logger.info(`[TradingService] Iniciando bucle de trading con intervalo de ${intervalMs / 1000} segundos...`);
  isTradingLoopActive = true;
  // Ejecutar un tick inmediatamente al iniciar
  tradingTick().catch(e => logger.error('[TradingService] Error en el primer tick de trading:', e));
  // Luego establecer el intervalo
  tradingLoopIntervalId = setInterval(async () => {
    if (isTradingLoopActive) {
      await tradingTick().catch(e => logger.error('[TradingService] Error en un tick de trading programado:', e));
    } else {
      logger.info('[TradingService] Bucle de trading detenido, no se ejecutará tick programado.');
      if (tradingLoopIntervalId) clearInterval(tradingLoopIntervalId);
    }
  }, intervalMs);
}

/**
 * Detiene el bucle de trading.
 */
function stopTradingLoop() {
  if (!isTradingLoopActive) {
    logger.warn('[TradingService] El bucle de trading no está activo.');
    return;
  }
  logger.info('[TradingService] Deteniendo bucle de trading...');
  isTradingLoopActive = false;
  if (tradingLoopIntervalId) {
    clearInterval(tradingLoopIntervalId);
    tradingLoopIntervalId = null;
    logger.info('[TradingService] Intervalo del bucle de trading limpiado.');
  }
}

module.exports = {
  processTradingPair, // Exportar para pruebas unitarias o llamadas manuales
  startTradingLoop,
  stopTradingLoop,
  isLoopActive: () => isTradingLoopActive,
};
