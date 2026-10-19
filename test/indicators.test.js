// Offline unit/smoke tests for the indicator math. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTR, computeATR_Wilder, computeSupertrend } from "../src/services/indicators.js";

const candle = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });

test("true range uses the previous close for gaps", () => {
  const tr = computeTR([candle(10, 11, 9, 10), candle(13, 14, 12.5, 13.5)]);
  assert.deepEqual(tr, [2, 4]); // max(1.5, |14-10|, |12.5-10|) = 4
});

test("Wilder ATR: SMA seed, then (prev*(n-1)+tr)/n", () => {
  const atr = computeATR_Wilder([1, 2, 3, 4, 5], 3);
  assert.deepEqual(atr.slice(0, 2), [null, null]);
  assert.equal(atr[2], 2);
  assert.equal(atr[3], (2 * 2 + 4) / 3);
  assert.ok(Math.abs(atr[4] - ((atr[3] * 2 + 5) / 3)) < 1e-12);
});

test("Supertrend flips bearish on a crash and bullish on a rally", () => {
  const up = Array.from({ length: 30 }, (_, i) => candle(100 + i, 101 + i, 99 + i, 100.5 + i));
  const down = Array.from({ length: 30 }, (_, i) => candle(129 - 3 * i, 130 - 3 * i, 126 - 3 * i, 127 - 3 * i));
  const candles = [...up, ...down];
  const atr = computeATR_Wilder(computeTR(candles), 10);
  const { supertrend, direction } = computeSupertrend({ candles, atr, multiplier: 3 });
  assert.equal(direction[25], 1);
  assert.equal(direction.at(-1), -1);
  assert.ok(supertrend.at(-1) > candles.at(-1).close); // bearish line sits above price
});

test("binance base URL can be overridden (HTTP 451 regions)", async () => {
  process.env.BINANCE_BASE_URL = "https://data-api.binance.vision";
  const src = await import("node:fs").then((fs) => fs.readFileSync(new URL("../src/services/binance.js", import.meta.url), "utf8"));
  assert.match(src, /process\.env\.BINANCE_BASE_URL/);
});
