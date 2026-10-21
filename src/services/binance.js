import axios from "axios";

// api.binance.com answers HTTP 451 from restricted regions (e.g. the US, parts of the EU
// hosting providers). Binance's public market-data mirror serves the same /api/v3/klines.
const BINANCE_BASE_URL =
  process.env.BINANCE_BASE_URL || "https://api.binance.com";

/**
 * Fetch OHLCV candles from Binance (one request, up to 1000 candles).
 * closeTime is returned so callers can drop the still-forming candle.
 */
export async function fetchKlines({
  symbol,
  interval,
  limit = 200,
  startTime,
}) {
  const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/klines`, {
    params: {
      symbol,
      interval,
      limit,
      ...(startTime && { startTime }),
    },
    timeout: 20000,
  });

  return response.data.map((k) => ({
    openTime: new Date(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
    trades: Number(k[8]),
    takerBuyVolume: Number(k[9]),
  }));
}

/**
 * All CLOSED candles needed to bring a series up to date.
 * - First run (no startTime): the newest `initialCount` closed candles.
 * - Later runs: every closed candle after `startTime`, paging with limit=1000, so gaps
 *   after downtime are backfilled instead of skipped.
 * The still-forming candle (closeTime >= now) is never returned.
 */
export async function fetchClosedKlines({
  symbol,
  interval,
  startTime,
  initialCount = 400,
  now = Date.now(),
  fetchPage = fetchKlines,
  pageLimit = 1000,
  maxPages = 50,
}) {
  const closed = (rows) => rows.filter((k) => k.closeTime < now);

  if (startTime == null) {
    const rows = await fetchPage({ symbol, interval, limit: Math.min(initialCount + 1, 1000) });
    return closed(rows).slice(-initialCount);
  }

  const out = [];
  let from = startTime;
  for (let page = 0; page < maxPages; page++) {
    const rows = await fetchPage({ symbol, interval, startTime: from, limit: pageLimit });
    const done = closed(rows);
    out.push(...done);
    if (rows.length < pageLimit || done.length < rows.length || rows.length === 0) break;
    from = rows[rows.length - 1].openTime.getTime() + 1;
  }
  return out;
}
