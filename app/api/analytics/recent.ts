import prisma from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const logs = await prisma.signalLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
    });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
} 