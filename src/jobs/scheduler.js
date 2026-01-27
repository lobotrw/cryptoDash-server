import cron from "node-cron";
import { fetchMarketData } from "./fetchMarketData.js";

/**
 * IMPORTANT:
 * These schedules align with Binance candle closes.
 * Offsets prevent all jobs firing at the same second.
 */

cron.schedule("*/30 * * * * *", () => fetchMarketData("5m"), {
  timezone: "UTC",
});
cron.schedule("*/5 * * * *", () => fetchMarketData("15m"), {
  timezone: "UTC",
});
cron.schedule("0 * * * *", () => fetchMarketData("1h"), { timezone: "UTC" });
cron.schedule("0 */4 * * *", () => fetchMarketData("4h"), { timezone: "UTC" });
cron.schedule("0 0 * * *", () => fetchMarketData("1d"), { timezone: "UTC" });

console.log("Market data cron scheduler started");
