-- CreateTable
CREATE TABLE "Coin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coinId" INTEGER NOT NULL,
    "timeframe" TEXT NOT NULL,
    "openTime" DATETIME NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "trades" INTEGER NOT NULL,
    "takerBuyVolume" REAL NOT NULL,
    CONSTRAINT "Candle_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Coin_symbol_key" ON "Coin"("symbol");

-- CreateIndex
CREATE INDEX "Candle_coinId_timeframe_idx" ON "Candle"("coinId", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_coinId_timeframe_openTime_key" ON "Candle"("coinId", "timeframe", "openTime");
