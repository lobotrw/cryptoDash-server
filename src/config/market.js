export const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "SOLUSDT",
  "DOGEUSDT",
  "POLUSDT", // MATICUSDT was delisted in Sept 2024 (renamed POL); its klines stop on 2024-09-10
  "DOTUSDT",
  "LTCUSDT",
];

export const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

export const INTERVAL_MS = {
  "5m": 5 * 60e3,
  "15m": 15 * 60e3,
  "1h": 60 * 60e3,
  "4h": 4 * 60 * 60e3,
  "1d": 24 * 60 * 60e3,
};

// Candles loaded on the first run of a symbol/timeframe
export const HISTORY_CANDLES = Number(process.env.HISTORY_CANDLES || 400);

export const ATR_LENGTH = 25;
export const SUPERTREND_MULTIPLIER = 3;

/** A series is stale when its newest closed candle is older than 2 intervals. */
export function isStale(lastOpenTime, timeframe, now = Date.now()) {
  if (!lastOpenTime) return true;
  const t = lastOpenTime instanceof Date ? lastOpenTime.getTime() : Number(lastOpenTime);
  return t + 3 * INTERVAL_MS[timeframe] < now; // open + 1 interval = close; > 2 more intervals behind
}
