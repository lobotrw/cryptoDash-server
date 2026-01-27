# ⚙️ CryptoDash – Market Server (Backend)

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

## ⚙️ Setup & Run (Local)

### 1️⃣ Install dependencies
```bash
npm install
```

---

### 2️⃣ Environment variables

Create `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cryptodash
BINANCE_API_KEY=
BINANCE_API_SECRET=
PORT=4000
```

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

The server runs scheduled jobs aligned with Binance candle closes:

- 5m → every 30 seconds (forming candle updates)
- 15m → every 5 minutes
- 1h → hourly
- 4h → every 4 hours
- 1d → daily

Each job:
1. Fetches latest candles
2. Stores / updates last candle
3. Recalculates ATR
4. Recalculates Supertrend

---

## API Endpoints

### Get candles
```
GET /api/candles?symbol=BTCUSDT&tf=1h&limit=200
```

### Response
```json
{
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
- Uses HL2 ± ATR × multiplier
- Sticky bands
- Direction state persisted
- Stored directly in candle records

---

## Important Notes

- Indicators depend on **historical continuity**
- Deleting candles may break indicator state
- Cron jobs should not overlap
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
