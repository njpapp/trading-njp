const db = require('../database/db');
const openAIService = require('./OpenAIService');
const ollamaService = require('./OllamaService');
const openRouterService = require('./OpenRouterService'); // NUEVO
const logger = require('../utils/logger');

// Valores por defecto para la configuración de IA si no se encuentran en la DB
const DEFAULT_AI_CONFIG = {
  OPENAI_ENABLED: true,
  OLLAMA_ENABLED: true,
  OPENROUTER_ENABLED: false, // NUEVO - OpenRouter desactivado por defecto
  DEFAULT_OPENROUTER_MODEL: 'mistralai/mistral-7b-instruct', // NUEVO - Modelo por defecto para OpenRouter
  // OPENAI_DEFAULT_MODEL: 'gpt-3.5-turbo', // Existente, si se quisiera
  // OLLAMA_DEFAULT_MODEL: 'gemma:2b',   // Existente, si se quisiera
};

async function getAIConfigFromDB() {
  try {
    const { rows } = await db.query("SELECT key, value FROM settings WHERE key IN ('OPENAI_ENABLED', 'OLLAMA_ENABLED', 'OPENROUTER_ENABLED', 'DEFAULT_OPENROUTER_MODEL')");
    const config = { ...DEFAULT_AI_CONFIG };
    rows.forEach(row => {
      if (row.key === 'OPENAI_ENABLED') config.OPENAI_ENABLED = row.value === 'true';
      if (row.key === 'OLLAMA_ENABLED') config.OLLAMA_ENABLED = row.value === 'true';
      if (row.key === 'OPENROUTER_ENABLED') config.OPENROUTER_ENABLED = row.value === 'true'; // NUEVO
      if (row.key === 'DEFAULT_OPENROUTER_MODEL' && row.value) config.DEFAULT_OPENROUTER_MODEL = row.value; // NUEVO
    });
    return config;
  } catch (error) {
    logger.error('[AIService] Error al obtener configuración de IA de la DB. Usando defaults.', { error: error.message });
    return { ...DEFAULT_AI_CONFIG };
  }
}

/**
 * Formatea el prompt para la IA basado en el contexto proporcionado.
 * @param {object} context - Contenedor de datos para el prompt.
 * @param {string} context.symbol - Símbolo del par (ej. BTCUSDT).
 * @param {object} context.marketData - Datos de mercado (ej. klines, ticker, depth).
 * @param {object} context.indicators - Indicadores técnicos calculados (ej. RSI, MACD).
 * @param {object} context.riskParams - Parámetros de riesgo (ej. maxLoss, riskBenefitRatio).
 * @param {object} context.accountInfo - Información de la cuenta (ej. balances, posiciones abiertas).
 * @param {string} context.strategyHint - Pista sobre la estrategia actual (ej. 'scalping', 'swing').
 * @returns {string} El prompt formateado.
 */
function formatPrompt(context) {
  // Esta es una función crucial y el prompt engineering es iterativo.
  // Empezamos con un prompt básico y lo mejoraremos.
  let prompt = `Análisis de Trading para el par ${context.symbol || 'desconocido'}:\n`;

  if (context.marketData) {
    prompt += '\n--- Datos de Mercado ---\n';
    if (context.marketData.klines && context.marketData.klines.length > 0) {
      const lastKline = context.marketData.klines[context.marketData.klines.length - 1];
      prompt += `Última vela (${context.marketData.klinesInterval || 'intervalo desconocido'}): Open=${lastKline.open}, High=${lastKline.high}, Low=${lastKline.low}, Close=${lastKline.close}, Volume=${lastKline.volume}\n`;
    }
    if (context.marketData.ticker) {
      prompt += `Precio Actual: ${context.marketData.ticker.price}\n`;
    }
    // Podríamos añadir profundidad del libro de órdenes si es relevante y no demasiado verboso.
  }

  if (context.indicators) {
    prompt += '\n--- Indicadores Técnicos ---\n';
    if (context.indicators.sma) prompt += `SMA(${context.indicators.smaPeriod || ''}): ${context.indicators.sma[context.indicators.sma.length-1]?.toFixed(2)}\n`;
    if (context.indicators.ema) prompt += `EMA(${context.indicators.emaPeriod || ''}): ${context.indicators.ema[context.indicators.ema.length-1]?.toFixed(2)}\n`;
    if (context.indicators.rsi) prompt += `RSI(${context.indicators.rsiPeriod || ''}): ${context.indicators.rsi[context.indicators.rsi.length-1]?.toFixed(2)}\n`;
    if (context.indicators.macd && context.indicators.macd.length > 0) {
      const lastMacd = context.indicators.macd[context.indicators.macd.length - 1];
      prompt += `MACD(${context.indicators.macdParams?.fastPeriod}, ${context.indicators.macdParams?.slowPeriod}, ${context.indicators.macdParams?.signalPeriod}): MACD=${lastMacd.MACD?.toFixed(2)}, Signal=${lastMacd.signal?.toFixed(2)}, Hist=${lastMacd.histogram?.toFixed(2)}\n`;
    }
  }

  if (context.riskParams) {
    prompt += '\n--- Parámetros de Riesgo ---\n';
    if (context.riskParams.maxAllowedLossPerTrade) prompt += `Pérdida máxima por trade: ${context.riskParams.maxAllowedLossPerTrade}%\n`;
    if (context.riskParams.minRiskBenefitRatio) prompt += `Ratio Riesgo/Beneficio mínimo: ${context.riskParams.minRiskBenefitRatio}\n`;
  }

  if (context.accountInfo) {
      prompt += '\n--- Información de Cuenta (resumen) ---\n';
      // Ejemplo: ¿Hay posiciones abiertas para este par? ¿Balance disponible para operar?
      // Esto necesita ser cuidadosamente seleccionado para no sobrecargar el prompt.
      if (context.accountInfo.availableBalanceQuote) prompt += `Saldo disponible (${context.symbol?.endsWith('USDT') ? 'USDT' : 'Moneda Cotizada'}): ${context.accountInfo.availableBalanceQuote?.toFixed(2)}\n`;
      if (context.accountInfo.currentPosition) {
          prompt += `Posición actual en ${context.symbol}: Cantidad=${context.accountInfo.currentPosition.quantity}, PrecioEntrada=${context.accountInfo.currentPosition.entryPrice}\n`;
      } else {
          prompt += `No hay posición abierta actualmente para ${context.symbol}.\n`;
      }
  }

  prompt += '\n--- Pregunta ---\n';
  prompt += 'Basado en los datos anteriores, ¿cuál es la próxima acción de trading recomendada (BUY, SELL, HOLD)? ';
  prompt += 'Proporciona una breve justificación para tu decisión. Limita tu respuesta a la acción y la justificación concisa.';
  prompt += 'Ejemplo de respuesta: \"DECISION: BUY. JUSTIFICACION: RSI bajo y cruce de MACD alcista.\"';

  return prompt;
}

/**
 * Obtiene una decisión de trading de un servicio de IA (OpenAI u Ollama).
 * @param {object} promptContext - El contexto para formatear el prompt (ver formatPrompt).
 * @param {number} pairId - El ID del par de trading (para logging en DB).
 * @returns {Promise<object|null>} Objeto con { decision, reason, modelUsed, rawResponse } o null.
 */
async function getTradingDecision(promptContext, pairId) {
  const aiConfig = await getAIConfigFromDB();
  const prompt = formatPrompt(promptContext);
  let decision = null;
  let reason = 'No se pudo obtener una decisión de la IA.';
  let modelUsed = 'None';
  let rawResponse = null;
  let aiProviderError = null;

  logger.debug('[AIService] Prompt generado para IA:', { prompt });

  if (aiConfig.OPENAI_ENABLED && openAIService.isServiceInitialized()) {
    logger.info('[AIService] Intentando obtener decisión de OpenAI...');
    try {
      // TODO: Configurar modelo, temperatura, etc. desde DB o promptContext si es necesario
      const openAIResponse = await openAIService.getDecision(prompt, { model: 'gpt-3.5-turbo' });
      if (openAIResponse) {
        modelUsed = 'OpenAI';
        rawResponse = openAIResponse;
        // Parsear la respuesta para extraer DECISION y JUSTIFICACION
        // Asumimos el formato "DECISION: [BUY/SELL/HOLD]. JUSTIFICACION: [texto]"
        const decisionMatch = openAIResponse.match(/DECISION:\s*([A-Z]+)/i);
        const reasonMatch = openAIResponse.match(/JUSTIFICACION:\s*(.+)/i);
        decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'NO_ACTION';
        reason = reasonMatch ? reasonMatch[1] : 'Respuesta de IA no contenía justificación clara.';
        logger.info(`[AIService] Decisión de OpenAI: ${decision}, Razón: ${reason}`);
      } else {
        aiProviderError = 'OpenAI devolvió una respuesta vacía.';
        logger.warn(`[AIService] ${aiProviderError}`);
      }
    } catch (error) {
      aiProviderError = `Error con OpenAI: ${error.message}`;
      logger.error(`[AIService] ${aiProviderError}`, error);
    }
  }

  // Fallback a OpenRouter si OpenAI no se usó o falló, y OpenRouter está habilitado/disponible
  if (!rawResponse && aiConfig.OPENROUTER_ENABLED && openRouterService.isServiceInitialized()) {
    logger.info(`[AIService] OpenAI no proporcionó respuesta (o está deshabilitado). Intentando con OpenRouter...`);
    if(aiProviderError && modelUsed === 'OpenAI') logger.info(`[AIService] Razón del fallo de OpenAI: ${aiProviderError}`);
    aiProviderError = null; // Resetear error para OpenRouter

    try {
      const openRouterModel = promptContext.aiOptions?.openRouterModel || aiConfig.DEFAULT_OPENROUTER_MODEL;
      logger.info(`[AIService] Usando modelo OpenRouter: ${openRouterModel}`);
      const openRouterResponse = await openRouterService.getDecision(prompt, { model: openRouterModel });
      if (openRouterResponse) {
        modelUsed = `OpenRouter:${openRouterModel}`; // Indicar OpenRouter y el modelo específico
        rawResponse = openRouterResponse;
        const decisionMatch = openRouterResponse.match(/DECISION:\s*([A-Z]+)/i);
        const reasonMatch = openRouterResponse.match(/JUSTIFICACION:\s*(.+)/i);
        decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'NO_ACTION';
        reason = reasonMatch ? reasonMatch[1] : 'Respuesta de IA (OpenRouter) no contenía justificación clara.';
        logger.info(`[AIService] Decisión de OpenRouter (${openRouterModel}): ${decision}, Razón: ${reason}`);
      } else {
        aiProviderError = 'OpenRouter devolvió una respuesta vacía.';
        logger.warn(`[AIService] ${aiProviderError} (Modelo: ${openRouterModel})`);
      }
    } catch (error) {
      const openRouterModel = promptContext.aiOptions?.openRouterModel || aiConfig.DEFAULT_OPENROUTER_MODEL;
      aiProviderError = `Error con OpenRouter (Modelo: ${openRouterModel}): ${error.message}`;
      logger.error(`[AIService] ${aiProviderError}`, error);
    }
  }

  // Fallback a Ollama si OpenAI no se usó o falló, y Ollama está habilitado/disponible
  if (!rawResponse && aiConfig.OLLAMA_ENABLED && ollamaService.isServiceAvailable()) {
    logger.info(`[AIService] OpenAI y/o OpenRouter no proporcionaron respuesta (o están deshabilitados). Intentando con Ollama...`);
    if(aiProviderError) logger.info(`[AIService] Razón del fallo del proveedor anterior: ${aiProviderError}`);
    aiProviderError = null; // Resetear error para Ollama

    try {
      // TODO: Configurar modelo desde DB o promptContext si es necesario
      const ollamaResponse = await ollamaService.getDecision(prompt, { model: 'gemma:2b' });
      if (ollamaResponse) {
        modelUsed = 'Ollama';
        rawResponse = ollamaResponse;
        const decisionMatch = ollamaResponse.match(/DECISION:\s*([A-Z]+)/i);
        const reasonMatch = ollamaResponse.match(/JUSTIFICACION:\s*(.+)/i);
        decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'NO_ACTION';
        reason = reasonMatch ? reasonMatch[1] : 'Respuesta de IA no contenía justificación clara.';
        logger.info(`[AIService] Decisión de Ollama: ${decision}, Razón: ${reason}`);
      } else {
        aiProviderError = 'Ollama devolvió una respuesta vacía.';
        logger.warn(`[AIService] ${aiProviderError}`);
      }
    } catch (error) {
      aiProviderError = `Error con Ollama: ${error.message}`;
      logger.error(`[AIService] ${aiProviderError}`, error);
    }
  }

  if (!rawResponse && aiProviderError) { // Si ambos fallaron y hubo un último error
      reason = aiProviderError; // Usar el último error como razón si no hay respuesta
  } else if (!rawResponse) { // Si simplemente no se usó ninguna IA
      reason = 'Ningún servicio de IA estaba habilitado o disponible para tomar una decisión.';
      logger.warn(`[AIService] ${reason}`);
  }

  // Validar la decisión final
  const validDecisions = ['BUY', 'SELL', 'HOLD', 'NO_ACTION'];
  if (!decision || !validDecisions.includes(decision)) {
      logger.warn(`[AIService] Decisión '${decision}' no es válida. Forzando a NO_ACTION.`);
      decision = 'NO_ACTION';
      if (rawResponse && !reason.startsWith('Error con')) { // Si hubo respuesta pero no se parseó bien la decisión
          reason = 'La IA devolvió una decisión no válida o no parseable. Respuesta original: ' + rawResponse;
      }
  }

  // Registrar la decisión en la base de datos
  try {
    const marketDataSnapshot = promptContext.marketData ? JSON.stringify(promptContext.marketData) : null;
    const indicatorsSnapshot = promptContext.indicators ? JSON.stringify(promptContext.indicators) : null;
    // riskAnalysisSnapshot se llenará más adelante cuando implementemos esa parte.

    await db.query(
      `INSERT INTO ai_decisions (pair_id, decision, reason, market_data_snapshot, indicators_snapshot, risk_analysis_snapshot, ai_model_used, prompt, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [pairId, decision, reason, marketDataSnapshot, indicatorsSnapshot, null, modelUsed, prompt, rawResponse]
    );
    logger.info('[AIService] Decisión de IA registrada en la base de datos.');
  } catch (dbError) {
    logger.error('[AIService] Error al registrar la decisión de IA en la base de datos:', { error: dbError.message });
    // No relanzar, la decisión ya se tomó, el logueo es secundario pero importante.
  }

  if (!rawResponse) { // Si no hubo respuesta de ninguna IA
      return { decision: 'NO_ACTION', reason, modelUsed, rawResponse: null, prompt };
  }

  return { decision, reason, modelUsed, rawResponse, prompt };
}

module.exports = {
  getTradingDecision,
  formatPrompt, // Exportar para pruebas o uso externo si es necesario
};
