import { SYMBOLS } from "../config/market.js";
import { fetchKlines } from "../services/binance.js";
import { saveCandles, getLastCandle } from "../services/candleStore.js";
import {
  computeAndStoreATR,
  computeAndStoreSupertrend,
} from "../services/indicators.js";

export async function fetchMarketData(timeframe) {
  console.log(`[${timeframe}] update`);

  for (const symbol of SYMBOLS) {
    try {
      const lastCandle = await getLastCandle({ symbol, timeframe });
      const isFirstRun = !lastCandle;

      const candles = await fetchKlines({
        symbol,
        interval: timeframe,
        startTime: isFirstRun ? undefined : lastCandle.openTime.getTime(),
        limit: isFirstRun ? 400 : 2,
      });

      if (candles.length > 0) {
        await saveCandles({ symbol, timeframe, candles });
        // indicators belong HERE
        await computeAndStoreATR({
          symbol,
          timeframe,
          atrLength: 25,
        });
        await computeAndStoreSupertrend({
          symbol,
          timeframe,
          atrLength: 25,
          multiplier: 3,
        });
        console.log(`✅ ${symbol} ${timeframe}`);
      }
    } catch (err) {
      console.error(`❌ ${symbol} ${timeframe}`, err.message);
    }
  }
}
