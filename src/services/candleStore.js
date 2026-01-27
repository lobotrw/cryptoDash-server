import prisma from "../prisma.js";

export async function saveCandles({ symbol, timeframe, candles }) {
  // Ensure coin exists
  const coin = await prisma.coin.upsert({
    where: { symbol },
    update: {},
    create: { symbol },
  });

  // Batch upsert instead of looping
  const updates = candles.map((c) =>
    prisma.candle.upsert({
      where: {
        coinId_timeframe_openTime: {
          coinId: coin.id,
          timeframe,
          openTime: c.openTime,
        },
      },
      update: {
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        trades: c.trades,
        takerBuyVolume: c.takerBuyVolume,
      },
      create: {
        coinId: coin.id,
        timeframe,
        ...c,
      },
    }),
  );

  await prisma.$transaction(updates);
  return updates.length;
}

export async function getLastCandle({ symbol, timeframe }) {
  const coin = await prisma.coin.findUnique({
    where: { symbol },
  });

  if (!coin) return null;

  return prisma.candle.findFirst({
    where: {
      coinId: coin.id,
      timeframe,
    },
    orderBy: {
      openTime: "desc",
    },
  });
}
