import express from "express";
import dotenv from "dotenv";
import "./jobs/scheduler.js";
import marketRoutes from "./routes/market.js";
import cors from "cors";
import { fetchMarketData } from "./jobs/fetchMarketData.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET"],
  }),
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

fetchMarketData("5m");
fetchMarketData("15m");
fetchMarketData("1h");
fetchMarketData("4h");
fetchMarketData("1d");

app.use("/api", marketRoutes);
