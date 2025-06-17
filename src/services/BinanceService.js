const Binance = require('node-binance-api');
const db = require('../database/db');
const { decrypt } = require('../utils/security'); // encrypt no se usa aquí directamente
const logger = require('../utils/logger');

let binanceClient = null;
let isInitialized = false;

/**
 * Inicializa el cliente de la API de Binance.
 * Obtiene los datos encriptados (JSON con apiKey y secretKey) de la base de datos,
 * los desencripta, parsea y configura el cliente.
 */
async function initializeBinanceClient() {
  if (isInitialized) {
    return binanceClient;
  }

  try {
    logger.info('[BinanceService] Inicializando cliente de Binance (con nuevo esquema de claves)...');
    const { rows } = await db.query(
      "SELECT encrypted_data, iv, auth_tag FROM api_keys WHERE service_name = 'binance' LIMIT 1"
    );

    if (rows.length === 0) {
      logger.error('[BinanceService] No se encontraron claves API para Binance en la base de datos (tabla api_keys, servicio binance).');
      throw new Error('Claves API de Binance no configuradas.');
    }

    const apiKeyRecord = rows[0];
    const { encrypted_data, iv, auth_tag } = apiKeyRecord;

    if (!encrypted_data || !iv || !auth_tag) {
      logger.error('[BinanceService] Registro de clave API incompleto en la base de datos para Binance (faltan encrypted_data, iv o auth_tag).');
      throw new Error('Registro de clave API de Binance incompleto.');
    }

    const decryptedJson = decrypt(encrypted_data, iv, auth_tag);

    if (!decryptedJson) {
      logger.error('[BinanceService] Falló la desencriptación de los datos de API de Binance. Verifica la API_ENCRYPTION_KEY y la integridad de los datos en la tabla api_keys.');
      throw new Error('Falló la desencriptación de los datos de API de Binance.');
    }

    let credentials;
    try {
      credentials = JSON.parse(decryptedJson);
    } catch (parseError) {
      logger.error('[BinanceService] Falló el parseo del JSON de credenciales de Binance después de desencriptar.', { error: parseError.message });
      throw new Error('Credenciales de Binance corruptas o en formato incorrecto.');
    }

    const { apiKey, secretKey } = credentials;

    if (!apiKey || !secretKey) {
      logger.error('[BinanceService] El JSON de credenciales desencriptado no contiene apiKey o secretKey.');
      throw new Error('apiKey o secretKey faltantes en las credenciales de Binance.');
    }

    binanceClient = new Binance().options({
      APIKEY: apiKey,
      APISECRET: secretKey,
      // verbose: true,
      // log: (...args) => logger.debug('[node-binance-api]', ...args),
    });

    await binanceClient.account(); // Probar autenticación

    isInitialized = true;
    logger.info('[BinanceService] Cliente de Binance inicializado y autenticado correctamente (con nuevo esquema de claves).');
    return binanceClient;

  } catch (error) {
    logger.error('[BinanceService] Error durante la inicialización del cliente de Binance:', { error: error.message, stack: error.stack });
    isInitialized = false;
    binanceClient = null;
    throw error;
  }
}

// --- Funciones de Datos de Mercado (sin cambios en su lógica interna por ahora) ---
async function getKlines(symbol, interval = '1h', limit = 100) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');
  try {
    const ticks = await binanceClient.candlesticks(symbol, interval, false, { limit });
    return ticks.map(t => ({
        openTime: t[0], open: parseFloat(t[1]), high: parseFloat(t[2]), low: parseFloat(t[3]), close: parseFloat(t[4]),
        volume: parseFloat(t[5]), closeTime: t[6], quoteAssetVolume: parseFloat(t[7]), numberOfTrades: t[8],
        takerBuyBaseAssetVolume: parseFloat(t[9]), takerBuyQuoteAssetVolume: parseFloat(t[10])
    }));
  } catch (error) {
    logger.error(`[BinanceService] Error al obtener klines para ${symbol}:`, { error: error.message });
    throw error;
  }
}

async function getDepth(symbol, limit = 100) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');
  try {
    // La librería node-binance-api usa 'depth'
    // Asegurarse que el límite es uno de los valores permitidos por Binance si es necesario.
    // Valores comunes: 5, 10, 20, 50, 100, 500, 1000
    const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000]; // 5000 puede requerir permisos especiales o no estar en todas las librerías
    const actualLimit = validLimits.includes(limit) ? limit : 100;

    const depthData = await binanceClient.depth(symbol, actualLimit);
    // Formatear si es necesario, la estructura suele ser {bids: [[price, quantity], ...], asks: [[price, quantity], ...]}
    // node-binance-api ya lo devuelve en un formato útil:
    // { lastUpdateId: ..., bids: { price: size, ... }, asks: { price: size, ... } }
    // Convertir a arrays de [price, quantity] para un formato más estándar si se prefiere
    const formatDepth = (depthSide) => {
        return Object.entries(depthSide).map(([price, quantity]) => [parseFloat(price), parseFloat(quantity)]);
    };
    return {
        lastUpdateId: depthData.lastUpdateId,
        bids: formatDepth(depthData.bids).sort((a, b) => b[0] - a[0]), // Mayor precio primero para bids
        asks: formatDepth(depthData.asks).sort((a, b) => a[0] - b[0])  // Menor precio primero para asks
    };
  } catch (error) {
    logger.error(`[BinanceService] Error al obtener profundidad para ${symbol}:`, { error: error.message });
    throw error;
  }
}

async function getTicker(symbol) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');
  try {
    // 'prices' devuelve todos los precios o el de un símbolo si se especifica.
    // Devuelve un objeto: { SYMBOL: price_string, ... }
    // o { SYMBOL: price_string } si el símbolo es dado
    const prices = await binanceClient.prices(symbol);
    if (symbol && prices[symbol]) {
      return { symbol: symbol, price: parseFloat(prices[symbol]) };
    } else if (!symbol) {
      // Si no se da un símbolo, 'prices' devuelve todos.
      // Convertir a un formato más útil si es necesario.
      const formattedPrices = {};
      for (const key in prices) {
        formattedPrices[key] = parseFloat(prices[key]);
      }
      return formattedPrices; // Devuelve todos los tickers
    }
    // Si se especificó un símbolo pero no se encontró (improbable con binance.prices)
    logger.warn(`[BinanceService] Ticker no encontrado para ${symbol} usando binance.prices.`);
    return null;
  } catch (error) {
    logger.error(`[BinanceService] Error al obtener ticker para ${symbol}:`, { error: error.message });
    throw error;
  }
}

// --- Funciones de Órdenes Spot (placeholders) ---
async function createSpotOrder(symbol, side, type, quantity, price, options = {}) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  // Validar side y type
  const validSides = ['BUY', 'SELL'];
  const validTypes = ['MARKET', 'LIMIT']; // Podríamos añadir: STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT, LIMIT_MAKER

  if (!validSides.includes(side.toUpperCase())) {
    throw new Error(`Lado de orden inválido: ${side}. Usar BUY o SELL.`);
  }
  if (!validTypes.includes(type.toUpperCase())) {
    throw new Error(`Tipo de orden inválido: ${type}. Usar MARKET o LIMIT.`);
  }

  const orderSide = side.toUpperCase();
  const orderType = type.toUpperCase();

  try {
    let orderResult;
    const orderOptions = { ...options }; // Clonar opciones para no modificar el original

    // Preparar parámetros comunes
    // quantity: cantidad de la moneda base
    // price: precio por unidad de la moneda base (requerido para LIMIT)

    if (orderType === 'LIMIT') {
      if (!price || price <= 0) {
        throw new Error('El precio es requerido para órdenes LIMIT y debe ser positivo.');
      }
      // Para órdenes LIMIT, 'price' y 'quantity' son suficientes para la librería.
      // Opciones adicionales como timeInForce (GTC, IOC, FOK) pueden ir en orderOptions.
      // Ejemplo: orderOptions.timeInForce = 'GTC';
      logger.info(`[BinanceService] Creando orden LIMIT ${orderSide} para ${quantity} ${symbol} @ ${price}`, orderOptions);
      if (orderSide === 'BUY') {
        orderResult = await binanceClient.buy(symbol, quantity, price, orderOptions, (error, response) => {
          if (error) return logger.error('[BinanceService] Error en callback de buy (LIMIT):', JSON.parse(error.body).msg || error);
          // logger.debug('[BinanceService] Respuesta de buy (LIMIT):', response);
        });
      } else { // SELL
        orderResult = await binanceClient.sell(symbol, quantity, price, orderOptions, (error, response) => {
          if (error) return logger.error('[BinanceService] Error en callback de sell (LIMIT):', JSON.parse(error.body).msg || error);
          // logger.debug('[BinanceService] Respuesta de sell (LIMIT):', response);
        });
      }
    } else if (orderType === 'MARKET') {
      // Para órdenes MARKET, el precio no se especifica.
      // La 'quantity' es para la moneda base en compras y ventas.
      // Binance también permite 'quoteOrderQty' para MARKET BUY (gastar X de la moneda cotizada).
      // Esta implementación usará 'quantity' (moneda base) por defecto.
      // Si se quiere usar quoteOrderQty, se puede pasar en options.
      logger.info(`[BinanceService] Creando orden MARKET ${orderSide} para ${quantity} ${symbol}`, orderOptions);
      if (orderSide === 'BUY') {
         // Para market buy, la librería espera (symbol, quantity, price=0, options)
         // donde price=0 indica market.
        orderResult = await binanceClient.marketBuy(symbol, quantity, orderOptions, (error, response) => {
            if (error) return logger.error('[BinanceService] Error en callback de marketBuy:', JSON.parse(error.body).msg || error);
        });
      } else { // SELL
        orderResult = await binanceClient.marketSell(symbol, quantity, orderOptions, (error, response) => {
            if (error) return logger.error('[BinanceService] Error en callback de marketSell:', JSON.parse(error.body).msg || error);
        });
      }
    }

    logger.info(`[BinanceService] Orden ${orderType} ${orderSide} creada para ${symbol}. Resultado:`, orderResult);
    // Formatear la respuesta para que sea consistente si es necesario.
    // La respuesta de node-binance-api suele ser bastante completa.
    return orderResult;

  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message; // Binance API a veces devuelve errores en error.body
    logger.error(`[BinanceService] Error al crear orden ${orderType} ${orderSide} para ${symbol}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message); // Relanzar el error con el mensaje de Binance si está disponible
  }
}

async function cancelSpotOrder(symbol, orderId) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  if (!symbol || !orderId) {
    throw new Error('Se requieren symbol y orderId para cancelar una orden Spot.');
  }

  try {
    logger.info(`[BinanceService] Cancelando orden Spot ID: ${orderId} para ${symbol}`);
    // La librería node-binance-api usa client.cancel(symbol, orderId, callback)
    const result = await binanceClient.cancel(symbol, orderId);
    // El callback es opcional si se usa await, la librería lo maneja.
    // Si hay un error, la promesa será rechazada.

    logger.info(`[BinanceService] Solicitud de cancelación de orden Spot enviada para ID: ${orderId}. Resultado:`, result);
    // La respuesta de cancelación exitosa incluye detalles de la orden.
    return result;
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error(`[BinanceService] Error al cancelar orden Spot ID ${orderId} para ${symbol}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

async function getSpotOrderStatus(symbol, orderId) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  if (!symbol || !orderId) {
    throw new Error('Se requieren symbol y orderId para obtener el estado de una orden Spot.');
  }

  try {
    logger.info(`[BinanceService] Obteniendo estado de orden Spot ID: ${orderId} para ${symbol}`);
    // La librería node-binance-api usa client.orderStatus(symbol, orderId, callback)
    const status = await binanceClient.orderStatus(symbol, orderId);
    // El callback es opcional con await.

    logger.info(`[BinanceService] Estado obtenido para orden Spot ID ${orderId}:`, status);
    // La respuesta contiene el estado completo de la orden.
    return status;
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    // Un error común es -2013 'Order does not exist.' que puede ser normal si ya se completó y purgó.
    if (errorMessage && errorMessage.includes('Order does not exist')) {
        logger.warn(`[BinanceService] La orden Spot ID ${orderId} para ${symbol} no existe (puede haberse completado y purgado o ser inválida).`, { orderId, symbol});
        // Podríamos devolver un estado específico o null para indicar que no se encontró.
        // Por ahora, relanzamos el error como lo hace la API.
    }
    logger.error(`[BinanceService] Error al obtener estado de orden Spot ID ${orderId} para ${symbol}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

// --- Funciones de Órdenes Margin (placeholders) ---
async function marginBorrow(asset, amount, symbol, options = {}) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  if (!asset || !amount || amount <= 0) {
    throw new Error('Se requieren asset y amount (positivo) para realizar un préstamo de margen.');
  }
  // 'symbol' es opcional para algunos endpoints de préstamo/reembolso en la API de Binance,
  // pero la librería node-binance-api puede requerirlo para ciertas funciones de margen.
  // En la API oficial, /sapi/v1/margin/loan, 'symbol' no es mandatorio si se opera en margen cruzado (isIsolated=FALSE)
  // pero sí lo es si es aislado (isIsolated=TRUE). La librería podría abstraer esto.
  // La función específica de la librería es client.marginLoan(asset, amount, symbol_optional, callback)
  // Para node-binance-api, symbol es opcional. Si se opera en margen aislado, debe proveerse.

  try {
    logger.info(`[BinanceService] Solicitando préstamo de margen: ${amount} ${asset}` + (symbol ? ` para el par ${symbol}` : ' (margen cruzado)') , options);

    const loanResult = await binanceClient.marginLoan(asset, amount, symbol, options);
    // Ejemplo de respuesta exitosa: { tranId: 12345, clientTag: "..." }

    logger.info(`[BinanceService] Préstamo de margen realizado para ${asset}. Resultado:`, loanResult);
    return loanResult; // Contiene tranId
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error(`[BinanceService] Error al realizar préstamo de margen para ${asset}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

async function marginRepay(asset, amount, symbol, options = {}) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  if (!asset || !amount || amount <= 0) {
    throw new Error('Se requieren asset y amount (positivo) para realizar un reembolso de margen.');
  }
  // Similar a marginBorrow, symbol es opcional y depende de si es margen cruzado o aislado.
  // node-binance-api usa client.marginRepay(asset, amount, symbol_optional, callback)

  try {
    logger.info(`[BinanceService] Solicitando reembolso de margen: ${amount} ${asset}` + (symbol ? ` para el par ${symbol}` : ' (margen cruzado)'), options);

    const repayResult = await binanceClient.marginRepay(asset, amount, symbol, options);
    // Ejemplo de respuesta exitosa: { tranId: 67890, clientTag: "..." }

    logger.info(`[BinanceService] Reembolso de margen realizado para ${asset}. Resultado:`, repayResult);
    return repayResult; // Contiene tranId
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error(`[BinanceService] Error al realizar reembolso de margen para ${asset}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}
async function createMarginOrder(symbol, side, type, quantity, price, options = {}) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  const validSides = ['BUY', 'SELL'];
  const validTypes = ['MARKET', 'LIMIT']; // Podríamos añadir más tipos específicos de margen si la API los soporta directamente

  if (!symbol) {
    throw new Error('El símbolo es requerido para órdenes de margen.');
  }
  if (!validSides.includes(side.toUpperCase())) {
    throw new Error(`Lado de orden inválido: ${side}. Usar BUY o SELL.`);
  }
  if (!validTypes.includes(type.toUpperCase())) {
    throw new Error(`Tipo de orden inválido: ${type}. Usar MARKET o LIMIT.`);
  }

  const orderSide = side.toUpperCase();
  const orderType = type.toUpperCase();

  try {
    let orderResult;
    // La librería node-binance-api usa opciones dentro del método para margen.
    // Opciones comunes: isIsolated (TRUE/FALSE), newClientOrderId, etc.
    // stopPrice, icebergQty podrían no ser soportados directamente por el método genérico de orden de margen
    // y podrían requerir llamadas a endpoints específicos si existen.
    // Por ahora, nos enfocamos en MARKET y LIMIT.

    // El método es client.marginOrder(side, symbol, quantity, price_optional, type_optional, options_optional, callback)
    // Para LIMIT: client.marginOrder('SELL', 'BTCUSDT', 1, 10000, 'LIMIT', {isIsolated: 'TRUE'})
    // Para MARKET: client.marginOrder('SELL', 'BTCUSDT', 1, false, 'MARKET', {isIsolated: 'TRUE'})

    const executionOptions = { ...options }; // isIsolated: 'TRUE' o 'FALSE' (default), etc.

    if (orderType === 'LIMIT') {
      if (!price || price <= 0) {
        throw new Error('El precio es requerido para órdenes LIMIT y debe ser positivo.');
      }
      logger.info(`[BinanceService] Creando orden de MARGEN ${orderType} ${orderSide} para ${quantity} ${symbol} @ ${price}`, executionOptions);
      orderResult = await binanceClient.marginOrder(orderSide, symbol, quantity, price, 'LIMIT', executionOptions);
    } else { // MARKET
      logger.info(`[BinanceService] Creando orden de MARGEN ${orderType} ${orderSide} para ${quantity} ${symbol}`, executionOptions);
      // Para market, el precio se omite (o se pasa como false/0 según la librería)
      orderResult = await binanceClient.marginOrder(orderSide, symbol, quantity, false, 'MARKET', executionOptions);
    }

    logger.info(`[BinanceService] Orden de MARGEN ${orderType} ${orderSide} creada para ${symbol}. Resultado:`, orderResult);
    // Respuesta típica: { symbol, orderId, clientOrderId, tranId (si se creó préstamo/reembolso automático), ... }
    return orderResult;

  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error(`[BinanceService] Error al crear orden de MARGEN ${orderType} ${orderSide} para ${symbol}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

async function cancelMarginOrder(symbol, orderId, options = {}) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  if (!symbol || !orderId) {
    throw new Error('Se requieren symbol y orderId para cancelar una orden de Margen.');
  }
  // Opciones pueden incluir isIsolated: 'TRUE'/'FALSE'
  const cancelOptions = { ...options };

  try {
    logger.info(`[BinanceService] Cancelando orden de MARGEN ID: ${orderId} para ${symbol}`, cancelOptions);
    // client.marginCancel(symbol, orderId, options_optional (isIsolated), callback)
    const result = await binanceClient.marginCancel(symbol, orderId, cancelOptions);

    logger.info(`[BinanceService] Solicitud de cancelación de orden de MARGEN enviada para ID: ${orderId}. Resultado:`, result);
    return result;
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error(`[BinanceService] Error al cancelar orden de MARGEN ID ${orderId} para ${symbol}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

async function getMarginOrderStatus(symbol, orderId, options = {}) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  if (!symbol || !orderId) {
    throw new Error('Se requieren symbol y orderId para obtener el estado de una orden de Margen.');
  }
  // Opciones pueden incluir isIsolated: 'TRUE'/'FALSE'
  const statusOptions = { ...options };

  try {
    logger.info(`[BinanceService] Obteniendo estado de orden de MARGEN ID: ${orderId} para ${symbol}`, statusOptions);
    // client.marginOrderStatus(symbol, orderId, options_optional (isIsolated), callback)
    const status = await binanceClient.marginOrderStatus(symbol, orderId, statusOptions);

    logger.info(`[BinanceService] Estado obtenido para orden de MARGEN ID ${orderId}:`, status);
    return status;
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    if (errorMessage && errorMessage.includes('Order does not exist')) {
        logger.warn(`[BinanceService] La orden de MARGEN ID ${orderId} para ${symbol} no existe.`, { orderId, symbol});
    }
    logger.error(`[BinanceService] Error al obtener estado de orden de MARGEN ID ${orderId} para ${symbol}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

// --- Funciones de Cuenta ---
async function getAccountBalances() {
  if (!isInitialized && !binanceClient) {
     throw new Error('Binance client no inicializado.');
  }
  try {
    const accountInfo = await binanceClient.account();
    const balances = accountInfo.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    return balances;
  } catch (error) {
    logger.error('[BinanceService] Error al obtener balances de la cuenta:', { error: error.message });
    throw error;
  }
}

async function getCrossMarginAccountDetails() {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');
  try {
    logger.info('[BinanceService] Obteniendo detalles de la cuenta de Margen Cruzado...');
    // Usa mgAccount() o marginAccount() que es un alias.
    const marginDetails = await binanceClient.mgAccount();
    // La respuesta incluye: borrowEnabled, marginLevel, totalAssetOfBtc, totalLiabilityOfBtc, totalNetAssetOfBtc,
    //                      tradeEnabled, transferEnabled, userAssets: [{asset, borrowed, free, interest, locked, netAsset}, ...]
    logger.info('[BinanceService] Detalles de la cuenta de Margen Cruzado obtenidos.');
    return marginDetails;
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error('[BinanceService] Error al obtener detalles de la cuenta de Margen Cruzado:', { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

async function getIsolatedMarginAccountDetails(symbols) {
  if (!isInitialized && !binanceClient) throw new Error('Binance client no inicializado.');

  const options = {};
  if (symbols) {
    // La API espera una cadena de símbolos separados por coma, ej: 'BTCUSDT,ETHUSDT,BNBUSDT'
    // Máximo 5 símbolos si se especifica. Si no se especifica 'symbols', devuelve todos.
    options.symbols = Array.isArray(symbols) ? symbols.join(',') : symbols;
  }

  try {
    logger.info(`[BinanceService] Obteniendo detalles de cuenta(s) de Margen Aislado${symbols ? ' para ' + options.symbols : ''}...`);
    // Usa mgIsolatedAccount() o isolatedMarginAccount() que es un alias
    const isolatedDetails = await binanceClient.mgIsolatedAccount(options);
    // La respuesta incluye: assets: [{ baseAsset: {...}, quoteAsset: {...}, symbol, isolatedCreated, enabled, marginLevel, ...}]
    // o totalAssetsOfBtc, totalLiabilityOfBtc, totalNetAssetOfBtc si no se especifican símbolos.
    logger.info(`[BinanceService] Detalles de Margen Aislado obtenidos${symbols ? ' para ' + options.symbols : ''}.`);
    return isolatedDetails;
  } catch (error) {
    const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
    logger.error(`[BinanceService] Error al obtener detalles de Margen Aislado${symbols ? ' para ' + options.symbols : ''}:`, { error: errorMessage, stack: error.stack });
    throw new Error(errorMessage || error.message);
  }
}

module.exports = {
  initializeBinanceClient,
  getKlines, getDepth, getTicker,
  createSpotOrder, cancelSpotOrder, getSpotOrderStatus,
  marginBorrow, marginRepay, createMarginOrder, cancelMarginOrder, getMarginOrderStatus,
  getAccountBalances,
  getCrossMarginAccountDetails, // Nueva
  getIsolatedMarginAccountDetails, // Nueva
};
