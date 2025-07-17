import prisma from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { timestamp, pair, direction, entry, exit, profitPct, confidence, result } = req.body;
    const log = await prisma.signalLog.create({
      data: {
        timestamp: new Date(timestamp),
        pair,
        direction,
        entry,
        exit,
        profitPct,
        confidence,
        result,
      },
    });
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: "Failed to log signal" });
  }
} 