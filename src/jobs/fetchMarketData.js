import { SYMBOLS, HISTORY_CANDLES, ATR_LENGTH, SUPERTREND_MULTIPLIER, isStale } from "../config/market.js";
import { fetchClosedKlines } from "../services/binance.js";
import { saveCandles, getLastCandle } from "../services/candleStore.js";
import { updateIndicators } from "../services/indicators.js";
import prisma from "../prisma.js";

// One run per timeframe at a time: a slow run is skipped over, never overlapped.
const running = new Set();

export function isRunning(timeframe) {
  return running.has(timeframe);
}

export async function withLock(key, fn) {
  if (running.has(key)) return { skipped: true };
  running.add(key);
  try {
    return { skipped: false, result: await fn() };
  } finally {
    running.delete(key);
  }
}

export async function fetchMarketData(timeframe) {
  const { skipped } = await withLock(timeframe, () => updateTimeframe(timeframe));
  if (skipped) console.log(`[${timeframe}] previous run still in progress, skipping`);
}

async function updateTimeframe(timeframe) {
  console.log(`[${timeframe}] update`);

  for (const symbol of SYMBOLS) {
    try {
      const lastCandle = await getLastCandle({ symbol, timeframe });

      // Closed candles only; after downtime this backfills every missing candle. The last stored
      // candle is re-requested too (same values if it was closed; corrects rows written by the
      // old version, which stored the still-forming candle).
      const candles = await fetchClosedKlines({
        symbol,
        interval: timeframe,
        startTime: lastCandle ? lastCandle.openTime.getTime() : undefined,
        initialCount: HISTORY_CANDLES,
      });

      if (candles.length > 0) {
        const first = candles[0];
        const revised =
          lastCandle &&
          first.openTime.getTime() === lastCandle.openTime.getTime() &&
          (first.close !== lastCandle.close || first.high !== lastCandle.high || first.low !== lastCandle.low);
        await saveCandles({ symbol, timeframe, candles });
        if (revised) {
          // the stored row was an unfinished candle (old version): recompute its indicators too
          await prisma.candle.update({
            where: { id: lastCandle.id },
            data: { atr: null, stUpper: null, stLower: null, supertrend: null, supertrendDir: null },
          });
        }
      }
      // no-op when every stored candle already has indicators
      const computed = await updateIndicators({ symbol, timeframe, atrLength: ATR_LENGTH, multiplier: SUPERTREND_MULTIPLIER });
      if (candles.length > 0 || computed > 0) {
        console.log(`✅ ${symbol} ${timeframe} +${candles.length} candles, ${computed} indicator rows`);
      }
      const newest = candles.length ? candles.at(-1).openTime : lastCandle?.openTime;
      if (isStale(newest, timeframe)) {
        console.warn(`⚠️ ${symbol} ${timeframe}: newest closed candle ${newest?.toISOString?.()} is stale (delisted symbol?)`);
      }
    } catch (err) {
      console.error(`❌ ${symbol} ${timeframe}`, err.message);
    }
  }
}
