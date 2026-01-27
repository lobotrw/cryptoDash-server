// services/indicators.js
import prisma from "../prisma.js";

export async function getCandlesForIndicator({
  symbol,
  timeframe,
  limit = 300,
}) {
  const coin = await prisma.coin.findUnique({ where: { symbol } });
  if (!coin) return { coin: null, candles: [] };

  const candles = await prisma.candle.findMany({
    where: { coinId: coin.id, timeframe },
    orderBy: { openTime: "desc" }, // fetch NEWEST first
    take: limit,
  });

  return { coin, candles: candles.reverse() }; //  reverse to ascending order
}

// services/indicators.js

export function computeTR(candles) {
  const tr = new Array(candles.length).fill(null);

  for (let i = 0; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;

    if (i === 0) {
      tr[i] = h - l;
      continue;
    }

    const prevClose = candles[i - 1].close;

    const tr1 = h - l;
    const tr2 = Math.abs(h - prevClose);
    const tr3 = Math.abs(l - prevClose);

    tr[i] = Math.max(tr1, tr2, tr3);
  }

  return tr;
}

export function computeATR_Wilder(tr, length = 10) {
  const atr = new Array(tr.length).fill(null);

  if (tr.length < length) return atr;

  // First ATR = simple average of first `length` TR values
  let sum = 0;
  for (let i = 0; i < length; i++) sum += tr[i];
  atr[length - 1] = sum / length;

  // Wilder smoothing
  for (let i = length; i < tr.length; i++) {
    atr[i] = (atr[i - 1] * (length - 1) + tr[i]) / length;
  }

  return atr;
}

// services/indicators.js
export async function saveATR({ coinId, timeframe, candles, atr }) {
  const updates = [];

  for (let i = 0; i < candles.length; i++) {
    if (atr[i] == null) continue;

    updates.push(
      prisma.candle.update({
        where: {
          coinId_timeframe_openTime: {
            coinId,
            timeframe,
            openTime: candles[i].openTime,
          },
        },
        data: {
          atr: atr[i],
        },
      }),
    );
  }

  await prisma.$transaction(updates);
  return updates.length;
}

// services/indicators.js
export async function computeAndStoreATR({
  symbol,
  timeframe,
  atrLength = 10,
}) {
  const { coin, candles } = await getCandlesForIndicator({
    symbol,
    timeframe,
    limit: 300,
  });

  if (!coin || candles.length === 0) return 0;

  const tr = computeTR(candles);
  const atr = computeATR_Wilder(tr, atrLength);

  const updated = await saveATR({
    coinId: coin.id,
    timeframe,
    candles,
    atr,
  });

  return updated;
}

export function computeSupertrend({ candles, atr, multiplier = 3 }) {
  const n = candles.length;

  const finalUpper = new Array(n).fill(null);
  const finalLower = new Array(n).fill(null);
  const supertrend = new Array(n).fill(null);
  const direction = new Array(n).fill(null); // 1 = bull, -1 = bear

  for (let i = 0; i < n; i++) {
    if (atr[i] == null) {
      // Clear direction for candles without ATR so they don't affect the next valid candle
      if (i > 0 && direction[i - 1] != null) {
        direction[i] = direction[i - 1];
      }
      continue;
    }

    const hl2 = (candles[i].high + candles[i].low) / 2;

    const basicUpper = hl2 + multiplier * atr[i];
    const basicLower = hl2 - multiplier * atr[i];

    // First valid candle
    if (i === 0 || finalUpper[i - 1] == null) {
      finalUpper[i] = basicUpper;
      finalLower[i] = basicLower;
      direction[i] = 1;
      supertrend[i] = finalLower[i];
      continue;
    }

    // --- Final Upper Band (sticky)
    if (
      basicUpper < finalUpper[i - 1] ||
      candles[i - 1].close > finalUpper[i - 1]
    ) {
      finalUpper[i] = basicUpper;
    } else {
      finalUpper[i] = finalUpper[i - 1];
    }

    // --- Final Lower Band (sticky)
    if (
      basicLower > finalLower[i - 1] ||
      candles[i - 1].close < finalLower[i - 1]
    ) {
      finalLower[i] = basicLower;
    } else {
      finalLower[i] = finalLower[i - 1];
    }

    // --- Direction
    if (candles[i].close > finalUpper[i - 1]) {
      direction[i] = 1;
    } else if (candles[i].close < finalLower[i - 1]) {
      direction[i] = -1;
    } else {
      direction[i] = direction[i - 1];
    }

    // --- Supertrend value
    supertrend[i] = direction[i] === 1 ? finalLower[i] : finalUpper[i];
  }

  return { supertrend, direction };
}

export async function saveSupertrend({
  coinId,
  timeframe,
  candles,
  supertrend,
  direction,
}) {
  const updates = [];

  for (let i = 0; i < candles.length; i++) {
    if (supertrend[i] == null) continue;

    updates.push(
      prisma.candle.update({
        where: {
          coinId_timeframe_openTime: {
            coinId,
            timeframe,
            openTime: candles[i].openTime,
          },
        },
        data: {
          supertrend: supertrend[i],
          supertrendDir: direction[i],
        },
      }),
    );
  }

  await prisma.$transaction(updates);
  return updates.length;
}

export async function computeAndStoreSupertrend({
  symbol,
  timeframe,
  multiplier = 3,
}) {
  const { coin, candles } = await getCandlesForIndicator({
    symbol,
    timeframe,
    limit: 300,
  });

  if (!coin || candles.length === 0) return 0;

  // ATR already computed & stored
  const atr = candles.map((c) => c.atr);

  const { supertrend, direction } = computeSupertrend({
    candles,
    atr,
    multiplier,
  });

  const updated = await saveSupertrend({
    coinId: coin.id,
    timeframe,
    candles,
    supertrend,
    direction,
  });

  return updated;
}
