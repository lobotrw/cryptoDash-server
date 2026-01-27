```md

\# CryptoDash – Market Server (Backend)



CryptoDash Server is a Node.js backend responsible for fetching cryptocurrency market data from Binance, storing it in a database, computing technical indicators, and exposing a REST API for client applications.



The backend follows an indicator-first design: all heavy computations (ATR, Supertrend, etc.) are performed server-side.



---



\## Features



\- Automated OHLCV candle fetching from Binance

\- Incremental candle updates (no full-history refetch)

\- Persistent candle storage by symbol and timeframe

\- ATR (Wilder) calculation

\- Supertrend indicator calculation

\- Cron-based scheduler aligned with candle closes

\- REST API for frontend dashboards and analytics tools



---



\## Tech Stack



\- Node.js

\- Prisma ORM

\- PostgreSQL (recommended) or SQLite (local testing)

\- Binance REST API

\- node-cron



---



\## Project Structure



```

src/

├─ api/

│  └─ candles.js

├─ services/

│  ├─ binance.js

│  ├─ candleStore.js

│  └─ indicators.js

├─ cron/

│  └─ scheduler.js

├─ config/

│  └─ market.js

├─ prisma/

│  └─ schema.prisma

└─ index.js

```



---



\## Setup and Run (Local)



\### 1. Install dependencies

```bash

npm install

```



---



\### 2. Environment variables



Create a `.env` file:



```env

DATABASE\_URL=postgresql://user:password@localhost:5432/cryptodash

BINANCE\_API\_KEY=

BINANCE\_API\_SECRET=

PORT=4000

```



---



\### 3. Database setup

```bash

npx prisma migrate dev

```



---



\### 4. Start server

```bash

npm run dev

```



Server will run at:

```

http://localhost:4000

```



---



\## Scheduler



The server runs scheduled jobs aligned with Binance candle closes:



\- 5m timeframe: every 30 seconds (forming candle updates)

\- 15m timeframe: every 5 minutes

\- 1h timeframe: hourly

\- 4h timeframe: every 4 hours

\- 1d timeframe: daily



Each scheduled execution performs the following steps:

1\. Fetch latest candles from Binance

2\. Insert or update candle records

3\. Recalculate ATR

4\. Recalculate Supertrend



---



\## API Endpoints



\### Get candles

```

GET /api/candles?symbol=BTCUSDT\&tf=1h\&limit=200

```



\### Example response

```json

{

&nbsp; "candles": \[

&nbsp;   {

&nbsp;     "openTime": "2024-01-01T00:00:00.000Z",

&nbsp;     "open": 42000,

&nbsp;     "high": 42500,

&nbsp;     "low": 41800,

&nbsp;     "close": 42350,

&nbsp;     "volume": 1234,

&nbsp;     "takerBuyVolume": 650,

&nbsp;     "atr": 320,

&nbsp;     "supertrend": 41750,

&nbsp;     "supertrendDir": 1

&nbsp;   }

&nbsp; ]

}

```



---



\## Indicator Logic



\### ATR

\- True Range calculation per candle

\- Wilder smoothing method

\- Stored directly on candle records



\### Supertrend

\- Based on HL2 ± ATR × multiplier

\- Sticky upper and lower bands

\- Direction state persisted between candles

\- Stored per candle in the database



---



\## Important Notes



\- Indicator calculations rely on historical continuity

\- Deleting candles may break indicator state

\- Cron jobs should not overlap

\- SQLite is suitable for local testing only

\- PostgreSQL is recommended for real usage



---



\## Disclaimer



This project is for educational and research purposes only.  

It does not constitute financial advice.



---



\## Author



VanHes1ng  

Crypto market systems and analytics

```



