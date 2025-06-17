-- Script para poblar la base de datos con datos de prueba
-- NOTA: Ejecutar este script eliminará datos existentes en las tablas afectadas.

-- Deshabilitar temporalmente triggers o constraints si es necesario (opcional, depende del schema)
-- SET session_replication_role = 'replica';

-- Limpiar tablas en orden inverso de dependencias o usar TRUNCATE con CASCADE
-- (Asumiendo que no hay ON DELETE CASCADE definido que simplificaría esto)
DELETE FROM system_logs;
DELETE FROM ai_decisions;
DELETE FROM transactions;
DELETE FROM api_keys;
DELETE FROM settings;
DELETE FROM trading_pairs; -- Asumir que pair_id en transactions/ai_decisions permite NULL o se borran antes
DELETE FROM users;

-- Resetear secuencias de ID para que los nuevos datos comiencen desde 1 (opcional)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE trading_pairs_id_seq RESTART WITH 1;
ALTER SEQUENCE settings_id_seq RESTART WITH 1; -- Si settings tiene un ID autoincremental y queremos resetearlo
ALTER SEQUENCE api_keys_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE ai_decisions_id_seq RESTART WITH 1;
ALTER SEQUENCE system_logs_id_seq RESTART WITH 1;


-- Insertar Usuario Administrador de Prueba
INSERT INTO users (username, password_hash, created_at, last_login) VALUES
('admin', '$2a$10$N9qo8uLOickqzAi8cOKt7SetupmVIWS63kG1fVIp7s7SxfAxL.f7K', NOW(), NULL);

-- Insertar Configuraciones (Settings)
-- (Algunas ya pueden existir por schema.sql, ON CONFLICT puede ser útil o borrar primero)
INSERT INTO settings (key, value, description) VALUES
('PAPER_TRADING_ENABLED', 'true', 'Modo Paper Trading activado para pruebas.'),
('OPENAI_ENABLED', 'true', 'OpenAI habilitado para pruebas.'),
('OLLAMA_ENABLED', 'false', 'Ollama deshabilitado para pruebas iniciales.'),
('OPENROUTER_ENABLED', 'true', 'OpenRouter.ai habilitado para pruebas.'),
('DEFAULT_OPENROUTER_MODEL', 'mistralai/mistral-7b-instruct', 'Modelo por defecto para OpenRouter.'),
('LOG_LEVEL', 'DEBUG', 'Nivel de log detallado para pruebas.'),
('DB_LOGGING_ENABLED', 'true', 'Habilitar logging en base de datos para pruebas.')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    last_updated = NOW();

-- Insertar Claves API (dummy encriptadas)
INSERT INTO api_keys (service_name, encrypted_data, iv, auth_tag, description) VALUES
('binance', 'encryptedbinanceapidatathisisjustaplaceholdervalueandnotrealencrypteddataobviouslyitshouldbemuchlongerandlooklikehex', 'binanceivbinanceivbinanceiv', 'binancetagbinancetagbinancetagbi', 'Claves dummy de Binance para pruebas'),
('openai', 'encryptedopenaiapidatathisisjustaplaceholdervalueandnotrealencrypteddataobviouslyitshouldbemuchlongerandlooklikehex', 'openaiivopenaiivopenaiiv', 'openaitagopenaitagopenaitagop', 'Clave dummy de OpenAI para pruebas'),
('openrouter', 'encryptedopenrouterapidatathisisjustaplaceholdervalueandnotrealencrypteddataobviouslyitshouldbemuchlongerandlooklikehex', 'routerivrouterivrouteriv', 'routertagroutertagroutertagro', 'Clave dummy de OpenRouter para pruebas')
ON CONFLICT (service_name) DO UPDATE SET
    encrypted_data = EXCLUDED.encrypted_data,
    iv = EXCLUDED.iv,
    auth_tag = EXCLUDED.auth_tag,
    description = EXCLUDED.description,
    last_updated = NOW();

-- Insertar Pares de Trading de Ejemplo
INSERT INTO trading_pairs (symbol, base_asset, quote_asset, is_active, margin_enabled, price_precision, quantity_precision, min_trade_size, tick_size, step_size, strategy_config) VALUES
('BTCUSDT', 'BTC', 'USDT', TRUE, TRUE, 2, 6, 0.0001, 0.01, 0.000001,
  '{
     "klinesInterval": "15m",
     "indicators": [
       { "name": "SMA", "period": 10 },
       { "name": "EMA", "period": 20 },
       { "name": "RSI", "period": 14 }
     ],
     "riskParams": { "minRiskBenefitRatio": 1.5, "useVolatilityCheck": true, "atrPeriod": 10, "maxAllowedATRPercentageOfPrice": 5.0 },
     "orderStrategy": { "defaultOrderType": "LIMIT", "limitOrderOffsetPercentage": 0.05, "useStopLoss": true, "stopLossPercentage": 1.0, "useTakeProfit": true, "takeProfitPercentage": 2.0 },
     "aiOptions": { "model": "gpt-3.5-turbo", "openRouterModel": "openai/gpt-3.5-turbo" }
   }'::JSONB
),
('ETHUSDT', 'ETH', 'USDT', TRUE, FALSE, 2, 5, 0.001, 0.01, 0.00001,
  '{
     "klinesInterval": "1h",
     "indicators": [ { "name": "RSI", "period": 14 }, { "name": "MACD", "params": {"fastPeriod":12,"slowPeriod":26,"signalPeriod":9}} ],
     "riskParams": { "minRiskBenefitRatio": 2.0, "useVolatilityCheck": false },
     "orderStrategy": { "defaultOrderType": "MARKET", "useStopLoss": true, "stopLossPercentage": 2.0, "useTakeProfit": true, "takeProfitPercentage": 4.0 },
     "aiOptions": { "openRouterModel": "mistralai/mistral-7b-instruct" }
   }'::JSONB
),
('ADAUSDT', 'ADA', 'USDT', FALSE, FALSE, 4, 1, 1, 0.0001, 0.1, NULL);

-- Insertar Transacciones de Ejemplo
-- (Asumir que pair_id 1 es BTCUSDT, pair_id 2 es ETHUSDT)
INSERT INTO transactions (pair_id, binance_order_id, type, mode, price, quantity, total_value, status, executed_at, is_paper_trade) VALUES
(1, 'paper_btc_buy1', 'BUY', 'MARGIN', 30000.00, 0.001, 30.00, 'FILLED', NOW() - INTERVAL '3 hour', TRUE),
(1, 'paper_btc_sell1', 'SELL', 'MARGIN', 30500.00, 0.001, 30.50, 'FILLED', NOW() - INTERVAL '2 hour', TRUE),
(2, 'real_eth_buy1', 'BUY', 'SPOT', 2000.00, 0.1, 200.00, 'FILLED', NOW() - INTERVAL '1 day', FALSE),
(2, 'paper_eth_buy2', 'BUY', 'SPOT', 1950.00, 0.05, 97.50, 'FILLED', NOW() - INTERVAL '1 hour', TRUE);

-- Insertar Decisiones de IA de Ejemplo
INSERT INTO ai_decisions (pair_id, decision, reason, market_data_snapshot, indicators_snapshot, ai_model_used, prompt, raw_response, timestamp) VALUES
(1, 'BUY', 'RSI bajo y MACD cruzando al alza en BTCUSDT.', '{"ticker": {"price": "30000"}}'::JSONB, '{"rsi": 25, "macd_hist": 0.5}'::JSONB, 'OpenAI:gpt-3.5-turbo', 'Prompt de ejemplo para BTCUSDT...', 'DECISION: BUY. JUSTIFICACION: RSI bajo y MACD cruzando al alza en BTCUSDT.', NOW() - INTERVAL '3 hour'),
(1, 'SELL', 'BTCUSDT alcanzó el objetivo de TP, posible reversión.', '{"ticker": {"price": "30500"}}'::JSONB, '{"rsi": 75}'::JSONB, 'OpenRouter:mistralai/mistral-7b-instruct', 'Prompt de ejemplo para BTCUSDT en TP...', 'DECISION: SELL. JUSTIFICACION: BTCUSDT alcanzó el objetivo de TP, posible reversión.', NOW() - INTERVAL '2 hour'),
(2, 'HOLD', 'ETHUSDT en rango, sin señal clara.', '{"ticker": {"price": "1980"}}'::JSONB, '{"rsi": 55}'::JSONB, 'Ollama:gemma:2b', 'Prompt de ejemplo para ETHUSDT...', 'DECISION: HOLD. JUSTIFICACION: ETHUSDT en rango, sin señal clara.', NOW() - INTERVAL '5 hour');

-- Insertar Logs del Sistema de Ejemplo
INSERT INTO system_logs (level, message, context_data, timestamp) VALUES
('INFO', 'Servidor iniciado en puerto 3000.', '{"port": 3000}'::JSONB, NOW() - INTERVAL '1 day'),
('WARN', 'BinanceService: Clave API no encontrada, intentando Paper Trading.', NULL, NOW() - INTERVAL '23 hour'),
('ERROR', 'AIService: Fallo al conectar con OpenAI (Timeout).', '{"service": "OpenAI", "error": "Timeout"}'::JSONB, NOW() - INTERVAL '10 hour'),
('DEBUG', 'TradingService: Procesando par BTCUSDT.', '{"pair": "BTCUSDT"}'::JSONB, NOW() - INTERVAL '4 hour');

-- Re-habilitar triggers o constraints si se deshabilitaron
-- SET session_replication_role = 'origin';

SELECT 'Datos de prueba insertados exitosamente.' AS status;
