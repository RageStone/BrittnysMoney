-- CreateTable
CREATE TABLE "SignalLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "pair" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entry" REAL NOT NULL,
    "exit" REAL NOT NULL,
    "profitPct" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "result" TEXT NOT NULL
);
