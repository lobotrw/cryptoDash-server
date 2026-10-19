# CryptoDash – Market Server (Backend)

CryptoDash Server is a Node.js backend that fetches cryptocurrency market data from Binance, stores it in a database, computes technical indicators, and exposes a REST API for visualization clients.

This server is designed to be **indicator-first**: all heavy calculations (ATR, Supertrend, etc.) are done server-side.

---

## Features

- Automated candle fetching from Binance
- OHLCV data storage (per symbol & timeframe)
- ATR (Wilder) calculation
- Supertrend indicator calculation
- Incremental updates (no refetching full history)
- Cron-based scheduler aligned with candle closes
- REST API for frontend dashboards

---

## Tech Stack

- Node.js
- Prisma ORM
- PostgreSQL (or SQLite for local testing)
- Binance REST API
- node-cron

---

## Project Structure

```
src/
├─ config/
│  └─ market.js          # symbols, timeframes, interval lengths, staleness rule
├─ jobs/
│  ├─ fetchMarketData.js # fetch closed candles (with backfill) + incremental indicators, per-timeframe lock
│  └─ scheduler.js       # node-cron schedules
├─ routes/
│  └─ market.js          # /api/coins, /api/candles
├─ services/
│  ├─ binance.js         # klines client, closed-candle + backfill paging
│  ├─ candleStore.js
│  └─ indicators.js      # incremental ATR (Wilder) + Supertrend (TradingView rules)
├─ prisma.js
└─ index.js
prisma/schema.prisma
test/indicators.test.js  # npm test
```

---

## ⚙️ Setup & Run (Local)

### 1️⃣ Install dependencies
```bash
npm install
```

---

### 2️⃣ Environment variables

Create `.env` file:

```env
DATABASE_URL=file:./dev.db
PORT=4000
# Optional: comma-separated browser origins allowed by CORS (default http://localhost:5173)
# CORS_ORIGIN=http://localhost:5173,https://dash.example.com
# Optional: candles loaded on the first run of each symbol/timeframe (default 400)
# HISTORY_CANDLES=400
# Optional. api.binance.com returns HTTP 451 from restricted regions; use the public
# market-data mirror instead (no key needed for klines):
# BINANCE_BASE_URL=https://data-api.binance.vision
```

No Binance API key is needed: only the public `/api/v3/klines` endpoint is used.
The bundled Prisma schema (`prisma/schema.prisma`) uses `provider = "sqlite"`, so `DATABASE_URL` must be a `file:` URL; a `postgresql://` URL fails every query until the provider is changed.

---

### 3️⃣ Database setup
```bash
npx prisma migrate dev
```

---

### 4️⃣ Start server
```bash
npm run dev
```

Server runs at:
```
http://localhost:4000
```

---

## Scheduler

Jobs run a few seconds after each candle closes:

- 5m: every 30 seconds
- 15m: every 5 minutes
- 1h: hourly
- 4h: every 4 hours
- 1d: daily

Each job:
1. Fetches every **closed** candle since the last stored one. Paging (limit 1000) backfills any gap after downtime. The still-forming candle is never stored.
2. Upserts the candles.
3. Computes ATR and Supertrend **incrementally** for the new candles only, starting from the stored state of the last computed candle. A closed candle's indicator values are written once and never change (no repainting).

The same timeframe never runs twice at once: a run that is still busy makes the next tick skip. On startup the timeframes load one after another.

---

## API Endpoints

### Get candles
```
GET /api/candles?symbol=BTCUSDT&tf=1h&limit=200
```

`limit` is 1–1000 (default 200), and `tf` must be one of 5m, 15m, 1h, 4h, 1d. Invalid values return HTTP 400.

### Response
```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "asOf": "2024-01-01T00:00:00.000Z",
  "stale": false,
  "candles": [
    {
      "openTime": "2024-01-01T00:00:00.000Z",
      "open": 42000,
      "high": 42500,
      "low": 41800,
      "close": 42350,
      "volume": 1234,
      "takerBuyVolume": 650,
      "atr": 320,
      "supertrend": 41750,
      "supertrendDir": 1
    }
  ]
}
```

---

## Indicator Logic

### ATR
- True Range calculation
- Wilder smoothing
- Stored per candle

### Supertrend
- HL2 ± ATR × multiplier, with sticky final bands
- Direction is tested against the **current** final bands, as in TradingView's `ta.supertrend`. It starts bearish on the first candle with an ATR.
- The final bands (`stUpper`, `stLower`) are stored, so the next candle can be computed from that state.

`stale: true` means the newest closed candle is more than 2 intervals old, for example a delisted symbol. MATICUSDT was replaced by POLUSDT.

---

## Important Notes

- Indicators depend on **historical continuity**. Gaps are backfilled automatically.
- The first ATR length − 1 candles of each series (24) have no indicator values (warm-up).
- A database written by the old version is upgraded on the first run: `npx prisma migrate deploy`, then the indicators are recomputed once from the first candle.
- SQLite is fine for local testing, PostgreSQL recommended for real usage

---

## Disclaimer

This project is for **educational and research purposes only**.  
It is **not financial advice**.

---

## Author

VanHes1ng  
Crypto systems & market analytics
```
