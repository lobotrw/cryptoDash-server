import cron from "node-cron";
import { fetchMarketData } from "./fetchMarketData.js";

/**
 * Jobs run a few seconds after each candle close (6-field cron: sec min hour ...).
 * Only closed candles are stored, and every run backfills anything missed, so a late or
 * skipped run never leaves a gap. fetchMarketData() never overlaps itself per timeframe.
 */
cron.schedule("*/30 * * * * *", () => fetchMarketData("5m"), { timezone: "UTC" });
cron.schedule("10 */5 * * * *", () => fetchMarketData("15m"), { timezone: "UTC" });
cron.schedule("15 0 * * * *", () => fetchMarketData("1h"), { timezone: "UTC" });
cron.schedule("20 0 */4 * * *", () => fetchMarketData("4h"), { timezone: "UTC" });
cron.schedule("25 0 0 * * *", () => fetchMarketData("1d"), { timezone: "UTC" });

console.log("Market data cron scheduler started");
