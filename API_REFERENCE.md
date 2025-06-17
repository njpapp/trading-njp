# Manual de Referencia de la API del Bot de Trading

Este documento describe los endpoints de la API disponibles para interactuar con el backend del bot de trading.

**Prefijo Base de la API:** `/api/v1`

**Autenticación:**
- Los endpoints marcados como **Protegido (JWT)** requieren un JSON Web Token válido en el header `Authorization`. Formato: `Authorization: Bearer <TU_JWT_AQUI>`.
- Los endpoints no marcados explícitamente como protegidos son públicos.

---

## 1. Autenticación (`/auth`)

### 1.1 Registrar Nuevo Usuario
- **Método:** `POST`
- **Ruta:** `/auth/register`
- **Descripción:** Registra un nuevo usuario en el sistema.
- **Autenticación:** Ninguna.
- **Cuerpo de la Solicitud (JSON):**
  ```json
  {
    "username": "nuevo_usuario",
    "password": "unaContraseñaSegura123"
  }
  ```
  - `username` (string, requerido): Nombre de usuario único.
  - `password` (string, requerido): Contraseña (mínimo 8 caracteres).
- **Respuesta Exitosa (201 Created):**
  ```json
  {
    "message": "Usuario registrado exitosamente. Por favor, inicia sesión.",
    "user": {
      "id": 1,
      "username": "nuevo_usuario",
      "createdAt": "2023-10-27T10:00:00.000Z"
    }
  }
  ```
- **Respuestas de Error:**
    - `400 Bad Request`: Campos faltantes o contraseña muy corta.
    - `409 Conflict`: El nombre de usuario ya está en uso.
    - `500 Internal Server Error`: Error al procesar el registro.

### 1.2 Iniciar Sesión
- **Método:** `POST`
- **Ruta:** `/auth/login`
- **Descripción:** Autentica un usuario y devuelve un JWT.
- **Autenticación:** Ninguna.
- **Cuerpo de la Solicitud (JSON):**
  ```json
  {
    "username": "admin",
    "password": "adminpassword"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Login exitoso.",
    "token": "eyJh... (JWT completo) ... WięA",
    "user": {
      "id": 1,
      "username": "admin"
    }
  }
  ```
- **Respuestas de Error:**
    - `400 Bad Request`: Campos faltantes.
    - `401 Unauthorized`: Credenciales inválidas.
    - `500 Internal Server Error`: Error al procesar el login o JWT_SECRET no configurado.

---

## 2. Configuraciones del Bot (`/settings`)

### 2.1 Obtener Todas las Configuraciones
- **Método:** `GET`
- **Ruta:** `/settings`
- **Descripción:** Devuelve una lista de todas las configuraciones globales del bot.
- **Autenticación:** Ninguna (Considerar proteger con JWT si se desea un dashboard completamente privado).
- **Respuesta Exitosa (200 OK):**
  ```json
  [
    { "key": "PAPER_TRADING_ENABLED", "value": "true", "description": "...", "last_updated": "..." },
    { "key": "OPENAI_ENABLED", "value": "true", "description": "...", "last_updated": "..." }
    // ... más settings
  ]
  ```
- **Respuestas de Error:**
    - `500 Internal Server Error`: Error al obtener configuraciones.

### 2.2 Obtener una Configuración Específica
- **Método:** `GET`
- **Ruta:** `/settings/:key`
- **Descripción:** Devuelve el valor de una configuración específica.
- **Autenticación:** Ninguna.
- **Parámetros de Ruta:**
  - `key` (string, requerido): La clave de la configuración (ej. `PAPER_TRADING_ENABLED`).
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "key": "PAPER_TRADING_ENABLED",
    "value": "true",
    "description": "Modo Paper Trading activado para pruebas.",
    "last_updated": "2023-10-27T10:00:00.000Z"
  }
  ```
- **Respuestas de Error:**
    - `404 Not Found`: Configuración con la clave especificada no encontrada.
    - `500 Internal Server Error`.

### 2.3 Actualizar una Configuración
- **Método:** `PUT`
- **Ruta:** `/settings/:key`
- **Descripción:** Actualiza el valor de una configuración existente.
- **Autenticación:** **Protegido (JWT)**.
- **Parámetros de Ruta:**
  - `key` (string, requerido): La clave de la configuración a actualizar.
- **Cuerpo de la Solicitud (JSON):**
  ```json
  {
    "value": "false"
  }
  ```
  - `value` (string/boolean/number, requerido): El nuevo valor para la configuración. Se convertirá a string si es necesario por el backend.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "key": "PAPER_TRADING_ENABLED",
    "value": "false",
    "description": "Modo Paper Trading activado para pruebas.",
    "last_updated": "2023-10-27T10:05:00.000Z"
  }
  ```
- **Respuestas de Error:**
    - `400 Bad Request`: Falta el campo `value`.
    - `401 Unauthorized`: Token JWT no provisto o inválido.
    - `403 Forbidden`: Token JWT válido pero sin permisos suficientes (no aplica con la config actual).
    - `404 Not Found`: Configuración con la clave especificada no encontrada.
    - `500 Internal Server Error`.

---

## 3. Pares de Trading (`/trading-pairs`)

### 3.1 Obtener Todos los Pares de Trading
- **Método:** `GET`
- **Ruta:** `/trading-pairs`
- **Descripción:** Devuelve una lista de todos los pares de trading configurados.
- **Autenticación:** Ninguna.
- **Parámetros de Consulta:**
  - `isActive` (boolean, opcional): Filtrar por estado activo (ej. `?isActive=true`).
- **Respuesta Exitosa (200 OK):**
  ```json
  [
    {
      "id": 1,
      "symbol": "BTCUSDT",
      "base_asset": "BTC",
      "quote_asset": "USDT",
      "is_active": true,
      "margin_enabled": true,
      "price_precision": 2,
      "quantity_precision": 6,
      "min_trade_size": "0.0001",
      "max_trade_size": null,
      "tick_size": "0.01",
      "step_size": "0.000001",
      "strategy_config": { "klinesInterval": "15m", "...": "..." },
      "created_at": "...",
      "last_updated": "..."
    }
    // ... más pares
  ]
  ```
- **Respuestas de Error:** `500 Internal Server Error`.

### 3.2 Añadir Nuevo Par de Trading
- **Método:** `POST`
- **Ruta:** `/trading-pairs`
- **Descripción:** Añade un nuevo par de trading a la configuración del bot.
- **Autenticación:** **Protegido (JWT)**.
- **Cuerpo de la Solicitud (JSON):**
  ```json
  {
    "symbol": "ADAUSDT",
    "base_asset": "ADA",
    "quote_asset": "USDT",
    "is_active": true,
    "margin_enabled": false,
    "price_precision": 4,
    "quantity_precision": 1,
    "min_trade_size": 1,
    "tick_size": 0.0001,
    "step_size": 0.1,
    "strategy_config": { "klinesInterval": "1h", "indicators": [{"name":"RSI", "period":14}] }
  }
  ```
  - Campos opcionales: `max_trade_size`, `strategy_config` (si es null, usará defaults del sistema).
- **Respuesta Exitosa (201 Created):** Devuelve el objeto del par creado.
- **Respuestas de Error:** `400 Bad Request`, `401 Unauthorized`, `409 Conflict` (símbolo duplicado), `500 Internal Server Error`.

### 3.3 Obtener un Par de Trading Específico
- **Método:** `GET`
- **Ruta:** `/trading-pairs/:id`
- **Descripción:** Devuelve un par de trading específico por su ID.
- **Autenticación:** Ninguna.
- **Parámetros de Ruta:** `id` (integer, requerido).
- **Respuesta Exitosa (200 OK):** Devuelve el objeto del par.
- **Respuestas de Error:** `404 Not Found`, `500 Internal Server Error`.

### 3.4 Actualizar Par de Trading
- **Método:** `PUT`
- **Ruta:** `/trading-pairs/:id`
- **Descripción:** Actualiza un par de trading existente. No se permite cambiar `symbol`, `base_asset`, `quote_asset`.
- **Autenticación:** **Protegido (JWT)**.
- **Parámetros de Ruta:** `id` (integer, requerido).
- **Cuerpo de la Solicitud (JSON):** Campos a actualizar (ej. `is_active`, `margin_enabled`, `strategy_config`, etc.).
  ```json
  {
    "is_active": false,
    "strategy_config": { "klinesInterval": "5m", "riskParams": { "minRiskBenefitRatio": 2.5 } }
  }
  ```
- **Respuesta Exitosa (200 OK):** Devuelve el objeto del par actualizado.
- **Respuestas de Error:** `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `500 Internal Server Error`.

### 3.5 Eliminar Par de Trading
- **Método:** `DELETE`
- **Ruta:** `/trading-pairs/:id`
- **Descripción:** Elimina un par de trading de la configuración.
- **Autenticación:** **Protegido (JWT)**.
- **Parámetros de Ruta:** `id` (integer, requerido).
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Par de trading ID 1 (BTCUSDT) eliminado exitosamente."
  }
  ```
- **Respuestas de Error:** `401 Unauthorized`, `404 Not Found`, `500 Internal Server Error` (ej. si el par está en uso y hay FK constraints).

---

## 4. Control del Bot (`/bot`)

### 4.1 Iniciar el Bot
- **Método:** `POST`
- **Ruta:** `/bot/start`
- **Descripción:** Inicia el bucle principal de trading del bot.
- **Autenticación:** **Protegido (JWT)**.
- **Cuerpo de la Solicitud (JSON, opcional):**
  ```json
  {
    "intervalMs": 60000
  }
  ```
  - `intervalMs` (integer, opcional): Intervalo en milisegundos para cada ciclo de trading. Usa default si no se provee.
- **Respuesta Exitosa (200 OK):** `{ "message": "Bot iniciado exitosamente." }`
- **Respuestas de Error:** `401 Unauthorized`, `409 Conflict` (si ya está activo), `500 Internal Server Error`.

### 4.2 Detener el Bot
- **Método:** `POST`
- **Ruta:** `/bot/stop`
- **Descripción:** Detiene el bucle principal de trading.
- **Autenticación:** **Protegido (JWT)**.
- **Respuesta Exitosa (200 OK):** `{ "message": "Bot detenido exitosamente." }`
- **Respuestas de Error:** `401 Unauthorized`, `409 Conflict` (si ya está detenido), `500 Internal Server Error`.

### 4.3 Obtener Estado del Bot
- **Método:** `GET`
- **Ruta:** `/bot/status`
- **Descripción:** Devuelve el estado actual del bot (activo/inactivo).
- **Autenticación:** Ninguna.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "isActive": true,
    "message": "El bot está en funcionamiento.",
    "timestamp": "2023-10-27T10:15:00.000Z"
    // ... más métricas de estado en el futuro
  }
  ```
- **Respuestas de Error:** `500 Internal Server Error`.

---

## 5. Visualización de Datos (`/view`)

Todos los endpoints bajo `/view` soportan los siguientes parámetros de consulta para **paginación y ordenación**:
- `page` (integer, opcional, default: 1): Número de página.
- `limit` (integer, opcional, default: 25): Número de items por página.
- `sortBy` (string, opcional): Campo por el cual ordenar (ej. `created_at`, `timestamp`). El default varía por endpoint.
- `sortOrder` (string, opcional, default: `DESC`): `ASC` o `DESC`.

### 5.1 Obtener Transacciones
- **Método:** `GET`
- **Ruta:** `/view/transactions`
- **Descripción:** Devuelve una lista paginada de transacciones.
- **Autenticación:** Ninguna.
- **Parámetros de Consulta (Filtros Adicionales):**
  - `pair_id` (integer, opcional)
  - `type` (string, opcional): `BUY` o `SELL`.
  - `mode` (string, opcional): `SPOT` o `MARGIN`.
  - `status` (string, opcional): Ej. `FILLED`, `CANCELED`.
  - `start_date` (string, opcional, formato YYYY-MM-DD): Filtra por `created_at >= start_date`.
  - `end_date` (string, opcional, formato YYYY-MM-DD): Filtra por `created_at <= end_date`.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": [ /* array de objetos de transacción */ ],
    "pagination": { "currentPage": 1, "totalPages": 5, "totalItems": 120, "itemsPerPage": 25 }
  }
  ```
- **Respuestas de Error:** `500 Internal Server Error`.

### 5.2 Obtener Decisiones de IA
- **Método:** `GET`
- **Ruta:** `/view/aidecisions`
- **Descripción:** Devuelve una lista paginada de decisiones de IA.
- **Autenticación:** Ninguna.
- **Parámetros de Consulta (Filtros Adicionales):**
  - `pair_id` (integer, opcional)
  - `decision` (string, opcional): `BUY`, `SELL`, `HOLD`, `NO_ACTION`.
  - `ai_model_used` (string, opcional): Ej. `OpenAI`, `Ollama`, `OpenRouter:mistralai/mistral-7b-instruct`.
  - `start_date` (string, opcional, formato YYYY-MM-DD): Filtra por `timestamp >= start_date`.
  - `end_date` (string, opcional, formato YYYY-MM-DD): Filtra por `timestamp <= end_date`.
- **Respuesta Exitosa (200 OK):** Similar a `/view/transactions`.
- **Respuestas de Error:** `500 Internal Server Error`.

### 5.3 Obtener Logs del Sistema
- **Método:** `GET`
- **Ruta:** `/view/systemlogs`
- **Descripción:** Devuelve una lista paginada de logs del sistema.
- **Autenticación:** Ninguna.
- **Parámetros de Consulta (Filtros Adicionales):**
  - `level` (string, opcional): `INFO`, `WARN`, `ERROR`, `DEBUG`.
  - `start_date` (string, opcional, formato YYYY-MM-DD): Filtra por `timestamp >= start_date`.
  - `end_date` (string, opcional, formato YYYY-MM-DD): Filtra por `timestamp <= end_date`.
- **Respuesta Exitosa (200 OK):** Similar a `/view/transactions`.
- **Respuestas de Error:** `500 Internal Server Error`.

---

## 6. Gestión de Claves de Exchange (`/exchange-keys`)

### 6.1 Guardar/Actualizar Claves API para un Servicio
- **Método:** `POST`
- **Ruta:** `/exchange-keys/:serviceName`
- **Descripción:** Guarda o actualiza las claves API encriptadas para un servicio (`binance`, `openai`, `openrouter`).
- **Autenticación:** **Protegido (JWT)**.
- **Parámetros de Ruta:**
  - `serviceName` (string, requerido): `binance`, `openai`, o `openrouter`.
- **Cuerpo de la Solicitud (JSON):**
  - Para `binance`: `{ "apiKey": "...", "secretKey": "..." }`
  - Para `openai` o `openrouter`: `{ "apiKey": "..." }`
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Claves API para 'binance' guardadas/actualizadas exitosamente. Es posible que se requiera un reinicio del bot para aplicar los cambios.",
    "data": { "service_name": "binance", "description": "...", "last_updated": "..." }
  }
  ```
- **Respuestas de Error:** `400 Bad Request`, `401 Unauthorized`, `500 Internal Server Error`.

### 6.2 Obtener Estado de Configuración de Claves API
- **Método:** `GET`
- **Ruta:** `/exchange-keys/status`
- **Descripción:** Devuelve si las claves API para los servicios soportados están configuradas.
- **Autenticación:** **Protegido (JWT)**.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "binance": { "configured": true },
    "openai": { "configured": false },
    "openrouter": { "configured": true }
  }
  ```
- **Respuestas de Error:** `401 Unauthorized`, `500 Internal Server Error`.

---

## 7. Salud de API (`/health`)

### 7.1 Verificar Salud del Servidor API
- **Método:** `GET`
- **Ruta:** `/health`
- **Descripción:** Endpoint simple para verificar que la API está en línea y respondiendo.
- **Autenticación:** Ninguna.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "API saludable",
    "timestamp": "2023-10-27T10:20:00.000Z"
  }
  ```
---
