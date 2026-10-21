// Offline unit tests (no network, no database). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTR, computeATR_Wilder, computeIndicators } from "../src/services/indicators.js";
import { fetchClosedKlines } from "../src/services/binance.js";
import { isStale, INTERVAL_MS, SYMBOLS } from "../src/config/market.js";
import { parseLimit } from "../src/routes/market.js";
import { withLock } from "../src/jobs/fetchMarketData.js";

const candle = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });

function randomCandles(n, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let p = 100;
  return Array.from({ length: n }, () => {
    const o = p;
    p = p * (1 + (rnd() - 0.5) * 0.06);
    const h = Math.max(o, p) * (1 + rnd() * 0.01);
    const l = Math.min(o, p) * (1 - rnd() * 0.01);
    return candle(o, h, l, p);
  });
}

// Literal port of TradingView's ta.supertrend (Pine direction: -1 = up, +1 = down)
function pineSupertrend(candles, atr, factor) {
  const st = [], dirPine = [];
  let prevUpper = null, prevLower = null, prevSt = null;
  for (let i = 0; i < candles.length; i++) {
    if (atr[i] == null) { st.push(null); dirPine.push(null); continue; }
    const src = (candles[i].high + candles[i].low) / 2;
    let upper = src + factor * atr[i], lower = src - factor * atr[i];
    const prevClose = i > 0 ? candles[i - 1].close : null;
    if (prevLower != null) lower = lower > prevLower || prevClose < prevLower ? lower : prevLower;
    if (prevUpper != null) upper = upper < prevUpper || prevClose > prevUpper ? upper : prevUpper;
    let d;
    if (i === 0 || atr[i - 1] == null) d = 1;
    else if (prevSt === prevUpper) d = candles[i].close > upper ? -1 : 1;
    else d = candles[i].close < lower ? 1 : -1;
    const s = d === -1 ? lower : upper;
    st.push(s); dirPine.push(d);
    prevUpper = upper; prevLower = lower; prevSt = s;
  }
  return { st, dir: dirPine.map((d) => (d == null ? null : -d)) };
}

test("true range uses the previous close for gaps", () => {
  const tr = computeTR([candle(10, 11, 9, 10), candle(13, 14, 12.5, 13.5)]);
  assert.deepEqual(tr, [2, 4]);
});

test("Wilder ATR: SMA seed, then (prev*(n-1)+tr)/n", () => {
  const atr = computeATR_Wilder([1, 2, 3, 4, 5], 3);
  assert.deepEqual(atr.slice(0, 2), [null, null]);
  assert.equal(atr[2], 2);
  assert.equal(atr[3], (2 * 2 + 4) / 3);
});

test("computeIndicators ATR equals full-series Wilder ATR; warm-up only for the first atrLength-1 candles", () => {
  const c = randomCandles(400);
  const res = computeIndicators(c, { atrLength: 25, multiplier: 3 });
  const ref = computeATR_Wilder(computeTR(c), 25);
  res.forEach((r, i) => (ref[i] == null ? assert.equal(r.atr, null) : assert.ok(Math.abs(r.atr - ref[i]) < 1e-9)));
  assert.equal(res.filter((r) => r.atr == null).length, 24); // was 124 of 400 with the 300-candle window
});

test("Supertrend matches a literal port of TradingView ta.supertrend", () => {
  const c = randomCandles(500, 7);
  const res = computeIndicators(c, { atrLength: 10, multiplier: 3 });
  const ref = pineSupertrend(c, res.map((r) => r.atr), 3);
  res.forEach((r, i) => {
    assert.equal(r.dir, ref.dir[i], `dir @${i}`);
    if (ref.st[i] != null) assert.ok(Math.abs(r.supertrend - ref.st[i]) < 1e-9, `st @${i}`);
  });
  assert.ok(new Set(res.map((r) => r.dir)).size >= 3); // null, 1, -1 all occur
});

test("NO REPAINT: computing in chunks from stored state == computing the whole series", () => {
  const c = randomCandles(600, 3);
  const full = computeIndicators(c, { atrLength: 25, multiplier: 3 });
  // Mirrors updateIndicators(): with stored state, only the new candles are computed from it;
  // without state (still in warm-up), the series is computed from its first candle.
  let out = [];
  let prev = null;
  for (const [a, b] of [[0, 10], [10, 300], [300, 301], [301, 450], [450, 600]]) {
    if (prev == null) out = computeIndicators(c.slice(0, b), { atrLength: 25, multiplier: 3 });
    else out.push(...computeIndicators(c.slice(a, b), { atrLength: 25, multiplier: 3, prev }));
    const r = out[b - 1];
    prev = r.atr == null ? null : { close: c[b - 1].close, atr: r.atr, upper: r.upper, lower: r.lower, dir: r.dir };
  }
  assert.equal(out.length, full.length);
  out.forEach((r, i) => assert.deepEqual(r, full[i], `candle ${i}`));
});

test("Supertrend flips bearish on a crash and bullish on a rally", () => {
  const up = Array.from({ length: 40 }, (_, i) => candle(100 + 3 * i, 101 + 3 * i, 99 + 3 * i, 101 + 3 * i));
  const down = Array.from({ length: 40 }, (_, i) => candle(217 - 4 * i, 218 - 4 * i, 212 - 4 * i, 213 - 4 * i));
  const res = computeIndicators([...up, ...down], { atrLength: 10, multiplier: 3 });
  assert.equal(res[39].dir, 1);
  assert.equal(res.at(-1).dir, -1);
  assert.ok(res.at(-1).supertrend > down.at(-1).close);
});

test("fetchClosedKlines: drops the forming candle and backfills a gap across pages", async () => {
  const iv = INTERVAL_MS["5m"];
  const t0 = Date.UTC(2026, 9, 19, 0, 0);
  const all = Array.from({ length: 2500 }, (_, i) => ({ openTime: new Date(t0 + i * iv), closeTime: t0 + (i + 1) * iv - 1 }));
  const now = all.at(-1).openTime.getTime() + 60e3; // last candle still forming
  const calls = [];
  const fetchPage = async ({ startTime, limit }) => {
    calls.push({ startTime, limit });
    const from = startTime == null ? all.length - limit : all.findIndex((k) => k.openTime.getTime() >= startTime);
    return all.slice(from, from + limit);
  };
  // last stored candle = #99 -> needs #100..#2498 (2399 candles), #2499 is forming
  const got = await fetchClosedKlines({ symbol: "X", interval: "5m", startTime: all[99].openTime.getTime() + 1, now, fetchPage });
  assert.equal(got.length, 2399);
  assert.equal(got[0].openTime.getTime(), all[100].openTime.getTime());
  assert.equal(got.at(-1).openTime.getTime(), all[2498].openTime.getTime());
  assert.ok(calls.length >= 3 && calls.every((c) => c.limit === 1000));

  const first = await fetchClosedKlines({ symbol: "X", interval: "5m", initialCount: 400, now, fetchPage });
  assert.equal(first.length, 400);
  assert.ok(first.every((k) => k.closeTime < now));
});

test("stale detection and delisted MATIC replaced", () => {
  const now = Date.UTC(2026, 9, 19, 12);
  assert.equal(isStale(new Date(Date.UTC(2024, 8, 10)), "1d", now), true);
  assert.equal(isStale(new Date(Date.UTC(2026, 9, 18)), "1d", now), false);
  assert.ok(!SYMBOLS.includes("MATICUSDT") && SYMBOLS.includes("POLUSDT"));
});

test("limit is validated and clamped", () => {
  assert.equal(parseLimit(undefined), 200);
  assert.equal(parseLimit("50"), 50);
  assert.equal(parseLimit("100000"), 1000);
  assert.equal(parseLimit("abc"), null);
  assert.equal(parseLimit("0"), null);
  assert.equal(parseLimit("-5"), null);
});

test("jobs for the same timeframe never overlap", async () => {
  let release;
  const slow = withLock("5m", () => new Promise((r) => (release = r)));
  const second = await withLock("5m", async () => "ran");
  assert.equal(second.skipped, true);
  const other = await withLock("1h", async () => "ran");
  assert.equal(other.result, "ran");
  release("done");
  assert.equal((await slow).result, "done");
  assert.equal((await withLock("5m", async () => "again")).result, "again");
});

test("binance base URL can be overridden (HTTP 451 regions)", async () => {
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("../src/services/binance.js", import.meta.url), "utf8"));
  assert.match(src, /process\.env\.BINANCE_BASE_URL/);
});
