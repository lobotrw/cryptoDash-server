import express from "express";
import prisma from "../prisma.js";
import { TIMEFRAMES, isStale } from "../config/market.js";

const router = express.Router();

/** Parse ?limit=: integer 1..1000, default 200. Returns null when invalid. */
export function parseLimit(raw, { def = 200, max = 1000 } = {}) {
  if (raw === undefined || raw === "") return def;
  if (!/^\d+$/.test(String(raw))) return null;
  const n = Number(raw);
  if (n < 1) return null;
  return Math.min(n, max);
}

/**
 * GET /api/coins
 * Returns all tracked coins
 */
router.get("/coins", async (req, res) => {
  try {
    const coins = await prisma.coin.findMany({
      orderBy: { symbol: "asc" },
    });
    res.json(coins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch coins" });
  }
});

/**
 * GET /api/candles
 * Query params:
 *  - symbol (required)
 *  - tf (required, one of TIMEFRAMES)
 *  - limit (optional, 1..1000, default 200)
 * Only CLOSED candles are stored/returned. `asOf` is the open time of the newest candle and
 * `stale` is true when it is more than 2 intervals old (e.g. a delisted symbol).
 */
router.get("/candles", async (req, res) => {
  const { symbol, tf } = req.query;

  if (!symbol || !tf) {
    return res.status(400).json({ error: "symbol and tf are required" });
  }
  if (!TIMEFRAMES.includes(tf)) {
    return res.status(400).json({ error: `tf must be one of ${TIMEFRAMES.join(", ")}` });
  }
  const limit = parseLimit(req.query.limit);
  if (limit == null) {
    return res.status(400).json({ error: "limit must be an integer between 1 and 1000" });
  }

  try {
    const coin = await prisma.coin.findUnique({ where: { symbol } });
    if (!coin) {
      return res.status(404).json({ error: "Coin not found" });
    }

    const candlesDesc = await prisma.candle.findMany({
      where: { coinId: coin.id, timeframe: tf },
      orderBy: { openTime: "desc" },
      take: limit,
    });

    // ascending order for charts
    const candles = candlesDesc.reverse();
    const asOf = candles.length ? candles.at(-1).openTime : null;

    res.json({
      symbol,
      timeframe: tf,
      asOf,
      stale: isStale(asOf, tf),
      candles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch candles" });
  }
});

export default router;
