import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

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
 *  - tf (required)
 *  - limit (optional, default 200)
 */
router.get("/candles", async (req, res) => {
  const { symbol, tf, limit = 200 } = req.query;

  if (!symbol || !tf) {
    return res.status(400).json({
      error: "symbol and tf are required",
    });
  }

  try {
    const coin = await prisma.coin.findUnique({
      where: { symbol },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
      });
    }

    const candlesDesc = await prisma.candle.findMany({
      where: {
        coinId: coin.id,
        timeframe: tf,
      },
      orderBy: {
        openTime: "desc",
      },
      take: Number(limit),
    });

    // IMPORTANT: reverse for chart
    const candles = candlesDesc.reverse();

    res.json({
      symbol,
      timeframe: tf,
      candles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch candles" });
  }
});

export default router;
