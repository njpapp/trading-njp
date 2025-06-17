# Sistema de Autotrading de Criptomonedas en Node.js

## Descripción Corta

Este proyecto es un sistema de autotrading de criptomonedas desarrollado en Node.js, utilizando PostgreSQL como base de datos. Se integra con la API de Binance para operaciones en Spot y Margin, y utiliza modelos de IA (OpenAI y/o Ollama local) para la toma de decisiones de trading.

## Características Principales

- **Integración con Binance:** Obtención de datos de mercado, ejecución de órdenes (Spot y Margin), gestión de saldos.
- **Módulo de Decisión IA:**
    - Soporte para OpenAI (GPT).
    - Soporte para Ollama (ej. gemma:2b) como alternativa local.
    - Configurable para elegir qué IA usar.
- **Indicadores Técnicos:** Cálculo de SMA, EMA, RSI, MACD, ATR.
- **Gestión de Riesgos:**
    - Chequeo de volatilidad basado en ATR.
    - Chequeo de Relación Riesgo-Beneficio (R:R) antes de operar.
    - (Pendiente/Conceptual: Stop-loss, take-profit automáticos post-entrada, pérdidas máximas diarias).
- **Modo Paper Trading:** Permite simular operaciones sin riesgo, registrándolas en la base de datos.
- **API de Control y Configuración:** Endpoints HTTP para gestionar configuraciones, pares de trading, visualizar datos y controlar el bot.
- **Seguridad:** Encriptación de claves API, autenticación por API Key para endpoints sensibles.
- **Base de Datos PostgreSQL:** Para almacenar configuraciones, transacciones, logs, decisiones de IA, etc.
- **Pruebas Unitarias:** Entorno de pruebas con Jest configurado.

## Arquitectura

- **Backend:** Node.js, Express.js
- **Base de Datos:** PostgreSQL
- **Conexión Exchange:** API de Binance (via `node-binance-api`)
- **Inteligencia Artificial:**
    - OpenAI API (`gpt-3.5-turbo`, `gpt-4`, etc.)
    - Ollama (local, ej. `gemma:2b`)
- **Cálculo de Indicadores:** `technicalindicators`

## Requisitos Previos

- Node.js (v16 o superior recomendado)
- npm (o yarn)
- PostgreSQL (instalado, servidor en ejecución y accesible)
- Cuenta de Binance (con claves API generadas si se opera en real)
- (Opcional) Clave API de OpenAI (si se va a usar el servicio de OpenAI)
- (Opcional) Ollama instalado y con modelos descargados (ej. `ollama pull gemma:2b`) si se va a usar IA local.

## Configuración

1.  **Clonar el Repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd <NOMBRE_DEL_DIRECTORIO>
    ```

2.  **Instalar Dependencias:**
    ```bash
    npm install
    ```

3.  **Configuración de la Base de Datos:**
    -   Asegúrate que tu servidor PostgreSQL esté en ejecución.
    -   Crea una base de datos para el proyecto (ej. `autotrading_db`).
    -   Conéctate a tu base de datos (usando `psql` o una herramienta gráfica) y ejecuta el script del esquema:
        ```bash
        psql -U tu_usuario_pg -d autotrading_db -a -f database/schema.sql
        ```
        (Reemplaza `tu_usuario_pg` y `autotrading_db` según corresponda).

4.  **Variables de Entorno:**
    -   Copia el archivo `.env.example` a un nuevo archivo llamado `.env`:
        ```bash
        cp .env.example .env
        ```
    -   Edita el archivo `.env` y configura las siguientes variables:
        -   `PORT`: Puerto para el servidor API (ej. 3000).
        -   `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`: Credenciales de tu base de datos PostgreSQL.
        -   `API_ENCRYPTION_KEY`: **¡MUY IMPORTANTE!** Una clave hexadecimal de 64 caracteres (32 bytes) para encriptar las claves API. Puedes generar una con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Guárdala de forma segura.
        -   `OLLAMA_BASE_URL`: URL de tu instancia de Ollama (ej. `http://localhost:11434`) si la vas a usar.
        -   `LOG_LEVEL`: Nivel de log (DEBUG, INFO, WARN, ERROR). Default: INFO.
        -   `DB_LOGGING_ENABLED`: `true` o `false` para habilitar/deshabilitar el logging en la tabla `system_logs`. Default: false.
        -   `API_ACCESS_KEY`: Clave API para proteger los endpoints de la API del bot. El cliente debe enviarla en el header `X-API-Key`. Genera una clave segura.

5.  **Configuración de Claves API (Binance, OpenAI) en la Base de Datos:**
    -   Las claves API para servicios externos (Binance, OpenAI) se almacenan encriptadas en la tabla `api_keys` de la base de datos.
    -   Para encriptar y generar el SQL necesario, puedes usar un script auxiliar. Se proporcionó un ejemplo de cómo hacerlo en los logs del subtask que creó `src/services/BinanceService.js` (buscar `encrypt_api_keys.js`). Deberás adaptar ese script:
        1.  Pon tu `API_ENCRYPTION_KEY` en el archivo `.env`.
        2.  En el script (ej. `encrypt_api_keys.js`), define `SERVICE_NAME` ('binance' o 'openai').
        3.  Para Binance: pon tu `ACTUAL_API_KEY` y `ACTUAL_SECRET_KEY`. El JSON a encriptar será `{ apiKey: '...', secretKey: '...' }`.
        4.  Para OpenAI: pon tu `ACTUAL_API_KEY`. El JSON a encriptar será `{ apiKey: 'sk-...' }`.
        5.  Ejecuta el script: `node encrypt_api_keys.js`.
        6.  Copia el SQL generado y ejecútalo en tu base de datos PostgreSQL.

## Uso

1.  **Iniciar el Servidor:**
    -   Para desarrollo (con reinicio automático):
        ```bash
        npm run dev
        ```
    -   Para producción:
        ```bash
        npm start
        ```
    El servidor API se iniciará en el puerto configurado (ej. 3000). Los servicios (Binance, OpenAI, Ollama) intentarán inicializarse.

2.  **Endpoints de la API (Prefijo: `/api/v1`):**
    -   **Salud:** `GET /health` - Verifica si la API está en línea.
    -   **Configuraciones (`/settings`):**
        -   `GET /`: Lista todas las configuraciones.
        -   `GET /:key`: Obtiene una configuración específica.
        -   `PUT /:key` (Protegido): Actualiza una configuración. Body: `{ "value": "nuevo_valor" }`.
    -   **Pares de Trading (`/trading-pairs`):**
        -   `GET /`: Lista pares (filtro opcional `?isActive=true`).
        -   `POST /` (Protegido): Añade un nuevo par.
        -   `GET /:id`: Obtiene un par por ID.
        -   `PUT /:id` (Protegido): Actualiza un par.
        -   `DELETE /:id` (Protegido): Elimina un par.
    -   **Control del Bot (`/bot`):**
        -   `POST /start` (Protegido): Inicia el bucle de trading. Body opcional: `{ "intervalMs": 30000 }`.
        -   `POST /stop` (Protegido): Detiene el bucle de trading.
        -   `GET /status`: Obtiene el estado actual del bot.
    -   **Visualización de Datos (`/view`):**
        -   `GET /transactions`: Lista transacciones (con paginación y filtros).
        -   `GET /aidecisions`: Lista decisiones de IA (con paginación y filtros).
        -   `GET /systemlogs`: Lista logs del sistema (con paginación y filtros).
    -   **Endpoints Protegidos:** Requieren el header `X-API-Key: tu_api_access_key_configurada_en_env`.

3.  **Modo Paper Trading:**
    -   Para activar/desactivar, actualiza el setting `PAPER_TRADING_ENABLED` a `true` o `false` usando la API:
        `PUT /api/v1/settings/PAPER_TRADING_ENABLED` con Body `{ "value": "true" }`.
    -   Cuando está activo, las órdenes no se envían a Binance sino que se simulan y se registran con `is_paper_trade = true`.

## Estructura del Proyecto (Resumen)

-   `src/`: Código fuente principal.
    -   `controllers/`: Lógica de manejo de solicitudes HTTP.
    -   `database/`: Conexión a DB (`db.js`) y schema (`schema.sql`).
    -   `middleware/`: Middlewares (ej. `authMiddleware.js`).
    -   `routes/`: Definición de rutas de la API.
    -   `services/`: Lógica de negocio (Binance, IA, Trading, etc.).
    -   `utils/`: Utilidades (logger, security, indicators).
    -   `server.js`: Punto de entrada principal de la aplicación.
-   `tests/`: Pruebas unitarias (configuradas con Jest).
-   `.env.example`: Plantilla para variables de entorno.
-   `package.json`: Dependencias y scripts.
-   `babel.config.js`, `jest.config.js`: Configuraciones de Babel y Jest.

## Pruebas

-   Para ejecutar todas las pruebas unitarias:
    ```bash
    npm test
    ```
-   Para ejecutar pruebas en modo watch:
    ```bash
    npm run test:watch
    ```
-   Para generar un reporte de cobertura de código:
    ```bash
    npm run test:coverage
    ```

## Contribuir

(Sección opcional si el proyecto es abierto a contribuciones)

## Licencia

(Especificar la licencia del proyecto, ej. MIT)
