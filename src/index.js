import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const { default: marketRoutes } = await import("./routes/market.js");
const { fetchMarketData } = await import("./jobs/fetchMarketData.js");
const { TIMEFRAMES } = await import("./config/market.js");
await import("./jobs/scheduler.js");

const app = express();
const PORT = process.env.PORT || 4000;
// Comma-separated list of allowed browser origins (default: the Vite dev server)
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: CORS_ORIGIN, methods: ["GET"] }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", marketRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT} (CORS: ${CORS_ORIGIN.join(", ")})`);
});

// Initial load: one timeframe after another (not all at once) to avoid SQLite lock contention
(async () => {
  for (const tf of TIMEFRAMES) await fetchMarketData(tf);
})();
