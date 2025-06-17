const AIService = require('../../src/services/AIService');
const openAIService = require('../../src/services/OpenAIService');
const ollamaService = require('../../src/services/OllamaService');
const db = require('../../src/database/db');
const logger = require('../../src/utils/logger'); // Para mockear logger si es necesario

// Mockear los módulos dependientes
jest.mock('../../src/services/OpenAIService');
jest.mock('../../src/services/OllamaService');
jest.mock('../../src/database/db');
jest.mock('../../src/utils/logger'); // Mockear logger para suprimir salida o verificar llamadas

describe('Services - AIService.js', () => {
  beforeEach(() => {
    // Resetear mocks antes de cada prueba
    jest.clearAllMocks();

    // Mockear db.query para que devuelva una configuración de IA por defecto
    // y para la inserción en ai_decisions
    db.query.mockImplementation(async (queryText, params) => {
      if (queryText.includes('SELECT key, value FROM settings')) {
        return {
          rows: [
            { key: 'OPENAI_ENABLED', value: 'true' },
            { key: 'OLLAMA_ENABLED', value: 'true' },
          ]
        };
      }
      if (queryText.includes('INSERT INTO ai_decisions')) {
        return { rows: [{ id: 123 }], rowCount: 1 }; // Simular inserción exitosa
      }
      return { rows: [], rowCount: 0 }; // Default mock response
    });
  });

  describe('formatPrompt', () => {
    const baseContext = {
      symbol: 'BTCUSDT',
      marketData: {
        klines: [{ open: 100, high: 110, low: 90, close: 105, volume: 1000 }],
        klinesInterval: '1h',
        ticker: { price: '105.50' }
      },
      indicators: {
        sma: [102.00], smaPeriod: 20,
        ema: [103.00], emaPeriod: 20,
        rsi: [45.00], rsiPeriod: 14,
        macd: [{ MACD: 1.2, signal: 1.0, histogram: 0.2 }],
        macdParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        atr: 2.5
      },
      riskParams: { maxAllowedLossPerTrade: 2, minRiskBenefitRatio: 1.5 },
      accountInfo: { availableBalanceQuote: 500.00, currentPosition: null },
      strategyHint: 'trend_following'
    };

    test('debería formatear un prompt completo con todos los datos', () => {
      const prompt = AIService.formatPrompt(baseContext);
      expect(prompt).toContain('Análisis de Trading para el par BTCUSDT');
      expect(prompt).toContain('Última vela (1h): Open=100, High=110, Low=90, Close=105, Volume=1000');
      expect(prompt).toContain('Precio Actual: 105.50');
      expect(prompt).toContain('SMA(20): 102.00');
      expect(prompt).toContain('EMA(20): 103.00');
      expect(prompt).toContain('RSI(14): 45.00');
      expect(prompt).toContain('MACD(12, 26, 9): MACD=1.20, Signal=1.00, Hist=0.20');
      // ATR no está en el prompt formateado actual, pero podría añadirse.
      expect(prompt).toContain('Pérdida máxima por trade: 2%');
      expect(prompt).toContain('Ratio Riesgo/Beneficio mínimo: 1.5');
      expect(prompt).toContain('Saldo disponible (USDT): 500.00');
      expect(prompt).toContain('No hay posición abierta actualmente para BTCUSDT.');
      expect(prompt).toContain('Basado en los datos anteriores, ¿cuál es la próxima acción de trading recomendada (BUY, SELL, HOLD)?');
    });

    test('debería manejar datos faltantes graciosamente', () => {
      const partialContext = {
        symbol: 'ETHUSDT',
        marketData: { ticker: { price: '2000.00' } },
        // No indicators, no riskParams, no accountInfo
      };
      const prompt = AIService.formatPrompt(partialContext);
      expect(prompt).toContain('Análisis de Trading para el par ETHUSDT');
      expect(prompt).toContain('Precio Actual: 2000.00');
      expect(prompt).not.toContain('--- Indicadores Técnicos ---');
      expect(prompt).not.toContain('--- Parámetros de Riesgo ---');
      expect(prompt).not.toContain('--- Información de Cuenta ---');
    });
  });

  describe('getTradingDecision', () => {
    const promptContext = { symbol: 'BTCUSDT', marketData: {}, indicators: {} }; // Contexto mínimo
    const pairId = 1;

    test('debería usar OpenAI si está habilitado y disponible', async () => {
      openAIService.isServiceInitialized.mockReturnValue(true);
      openAIService.getDecision.mockResolvedValue('DECISION: BUY. JUSTIFICACION: Looks good.');
      ollamaService.isServiceAvailable.mockReturnValue(false); // Asegurar que Ollama no se llame

      const result = await AIService.getTradingDecision(promptContext, pairId);

      expect(openAIService.getDecision).toHaveBeenCalledTimes(1);
      expect(ollamaService.getDecision).not.toHaveBeenCalled();
      expect(result.decision).toBe('BUY');
      expect(result.reason).toBe('Looks good.');
      expect(result.modelUsed).toBe('OpenAI');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_decisions'), expect.any(Array));
    });

    test('debería usar Ollama si OpenAI no está disponible o falla, y Ollama está habilitado', async () => {
      openAIService.isServiceInitialized.mockReturnValue(true);
      openAIService.getDecision.mockResolvedValue(null); // Simular fallo de OpenAI (respuesta vacía)
      ollamaService.isServiceAvailable.mockReturnValue(true);
      ollamaService.getDecision.mockResolvedValue('DECISION: SELL. JUSTIFICACION: Ollama says sell.');

      const result = await AIService.getTradingDecision(promptContext, pairId);

      expect(openAIService.getDecision).toHaveBeenCalledTimes(1);
      expect(ollamaService.getDecision).toHaveBeenCalledTimes(1);
      expect(result.decision).toBe('SELL');
      expect(result.reason).toBe('Ollama says sell.');
      expect(result.modelUsed).toBe('Ollama');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_decisions'), expect.any(Array));
    });

    test('debería usar Ollama si OpenAI está deshabilitado en config y Ollama está habilitado', async () => {
      db.query.mockImplementation(async (queryText, params) => { // Sobrescribir mock de DB para esta prueba
        if (queryText.includes('SELECT key, value FROM settings')) {
          return { rows: [{ key: 'OPENAI_ENABLED', value: 'false' }, { key: 'OLLAMA_ENABLED', value: 'true' }] };
        }
        if (queryText.includes('INSERT INTO ai_decisions')) { return { rowCount: 1, rows:[{id:1}] }; }
        return { rows: [] };
      });
      openAIService.isServiceInitialized.mockReturnValue(true); // Aunque esté inicializado, no se usará
      ollamaService.isServiceAvailable.mockReturnValue(true);
      ollamaService.getDecision.mockResolvedValue('DECISION: HOLD. JUSTIFICACION: Ollama says hold.');

      const result = await AIService.getTradingDecision(promptContext, pairId);

      expect(openAIService.getDecision).not.toHaveBeenCalled();
      expect(ollamaService.getDecision).toHaveBeenCalledTimes(1);
      expect(result.decision).toBe('HOLD');
      expect(result.modelUsed).toBe('Ollama');
    });

    test('debería devolver NO_ACTION si ninguna IA está disponible o todas fallan', async () => {
      openAIService.isServiceInitialized.mockReturnValue(false);
      ollamaService.isServiceAvailable.mockReturnValue(false);

      const result = await AIService.getTradingDecision(promptContext, pairId);

      expect(openAIService.getDecision).not.toHaveBeenCalled();
      expect(ollamaService.getDecision).not.toHaveBeenCalled();
      expect(result.decision).toBe('NO_ACTION');
      expect(result.reason).toContain('Ningún servicio de IA estaba habilitado o disponible');
      expect(result.modelUsed).toBe('None');
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_decisions'), expect.any(Array));
    });

    test('debería parsear correctamente la decisión y razón del formato esperado', async () => {
      openAIService.isServiceInitialized.mockReturnValue(true);
      const mockResponse = "DECISION: BUY. JUSTIFICACION: El RSI está en sobreventa (25) y el MACD muestra un cruce alcista. Precio actual cerca de soporte importante.";
      openAIService.getDecision.mockResolvedValue(mockResponse);

      const result = await AIService.getTradingDecision(promptContext, pairId);
      expect(result.decision).toBe('BUY');
      expect(result.reason).toBe('El RSI está en sobreventa (25) y el MACD muestra un cruce alcista. Precio actual cerca de soporte importante.');
      expect(result.rawResponse).toBe(mockResponse);
    });

    test('debería manejar una respuesta de IA mal formateada con NO_ACTION', async () => {
      openAIService.isServiceInitialized.mockReturnValue(true);
      openAIService.getDecision.mockResolvedValue('Respuesta inesperada sin formato DECISION/JUSTIFICACION.');

      const result = await AIService.getTradingDecision(promptContext, pairId);
      expect(result.decision).toBe('NO_ACTION');
      expect(result.reason).toMatch(/Respuesta de IA no contenía justificación clara|La IA devolvió una decisión no válida/);
    });

    test('debería registrar la decisión en la base de datos', async () => {
      openAIService.isServiceInitialized.mockReturnValue(true);
      openAIService.getDecision.mockResolvedValue('DECISION: BUY. JUSTIFICACION: Test.');

      await AIService.getTradingDecision(promptContext, pairId);

      expect(db.query).toHaveBeenCalledTimes(2); // 1 para settings, 1 para INSERT
      const insertCall = db.query.mock.calls.find(call => call[0].includes('INSERT INTO ai_decisions'));
      expect(insertCall).toBeDefined();
      expect(insertCall[1][0]).toBe(pairId); // pair_id
      expect(insertCall[1][1]).toBe('BUY'); // decision
      expect(insertCall[1][2]).toBe('Test.'); // reason
      // Podríamos verificar más parámetros del insert si es necesario.
    });
  });
});
