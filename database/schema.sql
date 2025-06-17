-- Tabla de Configuración General del Bot
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para Pares de Trading Soportados
CREATE TABLE trading_pairs (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL, -- Ejemplo: BTCUSDT
    base_asset VARCHAR(10) NOT NULL, -- Ejemplo: BTC
    quote_asset VARCHAR(10) NOT NULL, -- Ejemplo: USDT
    is_active BOOLEAN DEFAULT TRUE,
    min_trade_size DECIMAL(20, 8), -- Cantidad mínima para operar
    max_trade_size DECIMAL(20, 8), -- Cantidad máxima para operar
    tick_size DECIMAL(20, 8), -- Mínima variación de precio
    step_size DECIMAL(20, 8), -- Mínima variación de cantidad
    price_precision INTEGER DEFAULT 8, -- Número de decimales para el precio
    quantity_precision INTEGER DEFAULT 8, -- Número de decimales para la cantidad
    margin_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Transacciones (Órdenes)
CREATE TYPE order_type AS ENUM ('BUY', 'SELL');
CREATE TYPE trade_mode AS ENUM ('SPOT', 'MARGIN');
CREATE TYPE order_status AS ENUM ('NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'PENDING_CANCEL', 'REJECTED', 'EXPIRED');

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    pair_id INTEGER REFERENCES trading_pairs(id),
    binance_order_id VARCHAR(255) UNIQUE, -- ID de la orden en Binance
    client_order_id VARCHAR(255) UNIQUE, -- ID de la orden generado por nosotros (opcional)
    type order_type NOT NULL,
    mode trade_mode NOT NULL,
    price DECIMAL(20, 8), -- Precio de ejecución o límite
    quantity DECIMAL(20, 8) NOT NULL, -- Cantidad de la moneda base
    total_value DECIMAL(20, 8), -- Valor total de la transacción en la moneda cotizada (quantity * price)
    status order_status NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE, -- Cuándo se ejecutó/llenó la orden
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Decisiones de la IA
CREATE TYPE ai_decision_type AS ENUM ('BUY', 'SELL', 'HOLD', 'NO_ACTION');
CREATE TYPE ai_model_type AS ENUM ('OpenAI', 'Ollama', 'Fallback');

CREATE TABLE ai_decisions (
    id SERIAL PRIMARY KEY,
    pair_id INTEGER REFERENCES trading_pairs(id),
    decision ai_decision_type NOT NULL,
    reason TEXT, -- Explicación de la IA
    market_data_snapshot JSONB, -- Datos de mercado usados para la decisión (precio, volumen, etc.)
    indicators_snapshot JSONB, -- Valores de indicadores (RSI, MACD, etc.)
    risk_analysis_snapshot JSONB, -- Datos del análisis de riesgo (volatilidad, etc.)
    ai_model_used ai_model_type,
    prompt TEXT, -- El prompt enviado a la IA
    raw_response TEXT, -- La respuesta cruda de la IA
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Logs del Sistema
CREATE TYPE log_level AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level log_level NOT NULL,
    message TEXT NOT NULL,
    context_data JSONB, -- Datos adicionales de contexto en formato JSON
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para Almacenar Claves API de Forma Segura (Refactorizada)
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) UNIQUE NOT NULL, -- Ejemplo: 'binance', 'openai'
    encrypted_data TEXT NOT NULL, -- Datos encriptados (ej. JSON con api_key y secret_key)
    iv TEXT NOT NULL, -- Vector de inicialización usado para la encriptación (hex)
    auth_tag TEXT NOT NULL, -- AuthTag para GCM (hex)
    description TEXT, -- Descripción opcional de la clave
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ejemplo de cómo se vería una inserción (la encriptación se hace en la app):
-- INSERT INTO api_keys (service_name, encrypted_data, iv, auth_tag, description)
-- VALUES ('binance', '...', '...', '...', 'Claves de producción Binance Spot+Margin');

-- Insertar algunas configuraciones iniciales
INSERT INTO settings (key, value, description) VALUES
('OPENAI_ENABLED', 'true', 'Enable/Disable OpenAI for decisions. Boolean (true/false).'),
('OLLAMA_ENABLED', 'false', 'Enable/Disable Ollama as a fallback or primary. Boolean (true/false).'),
('OLLAMA_API_URL', 'http://localhost:11434/api/chat', 'URL for the Ollama API endpoint.'),
('GLOBAL_MAX_LOSS_PERCENTAGE_PER_TRADE', '2', 'Maximum loss percentage allowed per trade. Numeric.'),
('GLOBAL_MIN_RISK_BENEFIT_RATIO', '1.5', 'Minimum risk/benefit ratio required for a trade. Numeric.'),
('DEFAULT_TRADE_SIZE_USD', '100', 'Default trade size in USD for new trades if not specified by pair.'),
('LOG_LEVEL', 'INFO', 'Logging level for the system (INFO, WARN, ERROR, DEBUG).');

-- Ejemplo de cómo añadir un par (esto se haría vía API o interfaz luego)
-- INSERT INTO trading_pairs (symbol, base_asset, quote_asset, margin_enabled) VALUES ('BTCUSDT', 'BTC', 'USDT', TRUE);

-- Nota sobre encriptación de api_keys:
-- La encriptación/desencriptación se manejará en la aplicación.
-- Se necesitará una API_ENCRYPTION_KEY en las variables de entorno.
-- IV y AuthTag son cruciales para AES-GCM.
