// services/indicators.js
//
// ATR (Wilder) and Supertrend, computed INCREMENTALLY from the last stored state so that
// the value of a closed candle is computed once and never rewritten (no repainting).
// Supertrend follows TradingView's ta.supertrend reference.
import prisma from "../prisma.js";

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
    tr[i] = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
  }
  return tr;
}

export function computeATR_Wilder(tr, length = 10) {
  const atr = new Array(tr.length).fill(null);
  if (tr.length < length) return atr;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += tr[i];
  atr[length - 1] = sum / length; // first ATR = SMA of the first `length` TR values
  for (let i = length; i < tr.length; i++) {
    atr[i] = (atr[i - 1] * (length - 1) + tr[i]) / length; // Wilder smoothing
  }
  return atr;
}

/**
 * Compute ATR + Supertrend for `candles` (ascending), continuing from `prev`.
 *
 * prev = state of the candle right before candles[0]:
 *   { close, atr, upper, lower, dir }   (dir: 1 bull, -1 bear)
 * or null when candles[0] is the first candle of the series (ATR is then seeded with the
 * SMA of the first `atrLength` true ranges, and those warm-up candles get nulls).
 *
 * Returns one { atr, upper, lower, supertrend, dir } per candle. Because every value depends
 * only on `prev` and earlier candles, computing in chunks gives exactly the same numbers as
 * computing the whole series at once.
 */
export function computeIndicators(candles, { atrLength = 25, multiplier = 3, prev = null } = {}) {
  const out = [];
  let prevClose = prev ? prev.close : null;
  let atr = prev ? prev.atr : null;
  let upper = prev ? prev.upper : null;
  let lower = prev ? prev.lower : null;
  let dir = prev ? prev.dir : null;
  const seed = [];

  for (const c of candles) {
    const tr =
      prevClose == null
        ? c.high - c.low
        : Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));

    let newAtr = null;
    if (atr == null) {
      seed.push(tr);
      if (seed.length === atrLength) newAtr = seed.reduce((a, b) => a + b, 0) / atrLength;
    } else {
      newAtr = (atr * (atrLength - 1) + tr) / atrLength;
    }

    if (newAtr == null) {
      out.push({ atr: null, upper: null, lower: null, supertrend: null, dir: null });
    } else {
      const hl2 = (c.high + c.low) / 2;
      const basicUpper = hl2 + multiplier * newAtr;
      const basicLower = hl2 - multiplier * newAtr;
      let fu, fl, d;
      if (atr == null) {
        // first candle with an ATR (Pine: na(atr[1])) -> start in a downtrend, as ta.supertrend does
        fu = basicUpper;
        fl = basicLower;
        d = -1;
      } else {
        fu = basicUpper < upper || prevClose > upper ? basicUpper : upper;
        fl = basicLower > lower || prevClose < lower ? basicLower : lower;
        // direction against the CURRENT final bands
        if (dir === -1) d = c.close > fu ? 1 : -1;
        else d = c.close < fl ? -1 : 1;
      }
      upper = fu;
      lower = fl;
      dir = d;
      atr = newAtr;
      out.push({ atr: newAtr, upper: fu, lower: fl, supertrend: d === 1 ? fl : fu, dir: d });
    }
    prevClose = c.close;
  }
  return out;
}

/**
 * Bring stored indicators up to date for one series.
 * Only candles AFTER the last candle that has full indicator state are computed and written.
 * If no candle has state yet (new series, or rows from the old repainting version), the whole
 * series is computed once from its first candle.
 */
export async function updateIndicators({ symbol, timeframe, atrLength = 25, multiplier = 3 }) {
  const coin = await prisma.coin.findUnique({ where: { symbol } });
  if (!coin) return 0;

  const last = await prisma.candle.findFirst({
    where: { coinId: coin.id, timeframe, stUpper: { not: null } },
    orderBy: { openTime: "desc" },
  });
  const pending = await prisma.candle.findMany({
    where: { coinId: coin.id, timeframe, ...(last && { openTime: { gt: last.openTime } }) },
    orderBy: { openTime: "asc" },
  });
  if (pending.length === 0) return 0;

  const prev = last
    ? { close: last.close, atr: last.atr, upper: last.stUpper, lower: last.stLower, dir: last.supertrendDir }
    : null;
  const res = computeIndicators(pending, { atrLength, multiplier, prev });

  const updates = pending.map((c, i) =>
    prisma.candle.update({
      where: { id: c.id },
      data: {
        atr: res[i].atr,
        stUpper: res[i].upper,
        stLower: res[i].lower,
        supertrend: res[i].supertrend,
        supertrendDir: res[i].dir,
      },
    }),
  );
  await prisma.$transaction(updates);
  return updates.length;
}
