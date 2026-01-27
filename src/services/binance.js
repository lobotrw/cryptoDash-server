import axios from "axios";

const BINANCE_BASE_URL = "https://api.binance.com";

/**
 * Fetch OHLCV candles from Binance
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
  });

  return response.data.map((k) => ({
    openTime: new Date(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    trades: Number(k[8]),
    takerBuyVolume: Number(k[9]),
  }));
}
