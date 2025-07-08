import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { Signal, parseSignal } from "@/lib/utils"

const SHEET_ID = "1oxZJKLN2DVV1c1PLhUVQgZJ4QA6iGTKC9hcEBCD8fpw"
const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), "service-account.json")

// Helper to get an authenticated Google Sheets client
async function getSheetsClient() {
  try {
    const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"))
    const scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    const { google } = await import("googleapis")
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes,
    })
    return google.sheets({ version: "v4", auth })
  } catch (err) {
    console.error("Failed to load service account credentials:", err)
    throw new Error("Google Sheets credentials missing or invalid.")
  }
}

// Helper function to convert column number to letter
function numberToColumn(num: number): string {
  let result = ""
  while (num > 0) {
    num--
    result = String.fromCharCode(65 + (num % 26)) + result
    num = Math.floor(num / 26)
  }
  return result
}

// Get the first sheet name in the spreadsheet
async function getFirstSheetName(sheetsClient: any): Promise<string> {
  try {
    const meta = await sheetsClient.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: "sheets.properties.title",
    })
    return meta.data.sheets?.[0]?.properties?.title ?? "Sheet1"
  } catch (err) {
    console.error("Failed to fetch sheet metadata:", err)
    throw new Error("Could not fetch sheet metadata.")
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const sheetsClient = await getSheetsClient()

    if (action === "fetch") {
      const sheetName = await getFirstSheetName(sheetsClient)
      const range = `${sheetName}!A:AI`
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
      })
      const rows = response.data.values || []
      if (rows.length <= 1) {
        return NextResponse.json({ signals: [] })
      }
      // Skip header row and convert to signal objects
      const signals = rows.slice(1).map(parseSignal).filter((s): s is Signal => s !== null)
      return NextResponse.json({ signals })
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Sheets API error:", error)
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, signal } = body
    const sheetsClient = await getSheetsClient()

    if (action === "add") {
      // Add a single signal to the sheet
      const values = [[
        signal.id,
        signal.pair,
        signal.direction,
        signal.entryPrice,
        signal.stopLoss,
        signal.takeProfit,
        signal.timeframe,
        signal.confidence,
        signal.timestamp,
        signal.currentPrice,
        signal.reasoning,
        signal.status,
        signal.exitPrice || "",
        signal.pnl || "",
        signal.pnlPercent || "",
        signal.checkedAt || "",
        signal.indicators.rsi,
        signal.indicators.stoch,
        signal.indicators.williams,
        signal.indicators.cci,
        signal.indicators.atr,
        signal.indicators.sma,
        signal.indicators.ema,
        signal.indicators.momentum,
        signal.indicators.macd,
        signal.indicators.macdSignal,
        signal.indicators.macdHist,
        signal.indicators.bbUpper,
        signal.indicators.bbLower,
        signal.indicators.bbMiddle,
        signal.indicators.adx,
        signal.indicators.obv,
        signal.indicators.mfi,
        signal.indicators.stochrsi,
      ]]
      const sheetName = await getFirstSheetName(sheetsClient)
      const range = `${sheetName}!A:AI`
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      })
      return NextResponse.json({ success: true })
    }

    if (action === "update") {
      // Update an existing signal
      const sheetName = await getFirstSheetName(sheetsClient)
      const idRange = `${sheetName}!A:A`
      const fetchResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: idRange,
      })
      const ids = fetchResponse.data.values || []
      let rowNumber = -1
      for (let i = 1; i < ids.length; i++) {
        if (ids[i][0] === signal.id) {
          rowNumber = i + 1 // Google Sheets is 1-indexed
          break
        }
      }
      if (rowNumber === -1) {
        return NextResponse.json({ error: "Signal not found" }, { status: 404 })
      }
      const updateRange = `${sheetName}!A${rowNumber}:AI${rowNumber}`
      const values = [[
        signal.id,
        signal.pair,
        signal.direction,
        signal.entryPrice,
        signal.stopLoss,
        signal.takeProfit,
        signal.timeframe,
        signal.confidence,
        signal.timestamp,
        signal.currentPrice,
        signal.reasoning,
        signal.status,
        signal.exitPrice || "",
        signal.pnl || "",
        signal.pnlPercent || "",
        signal.checkedAt || "",
        signal.indicators.rsi,
        signal.indicators.stoch,
        signal.indicators.williams,
        signal.indicators.cci,
        signal.indicators.atr,
        signal.indicators.sma,
        signal.indicators.ema,
        signal.indicators.momentum,
        signal.indicators.macd,
        signal.indicators.macdSignal,
        signal.indicators.macdHist,
        signal.indicators.bbUpper,
        signal.indicators.bbLower,
        signal.indicators.bbMiddle,
        signal.indicators.adx,
        signal.indicators.obv,
        signal.indicators.mfi,
        signal.indicators.stochrsi,
      ]]
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: updateRange,
        valueInputOption: "RAW",
        requestBody: { values },
      })
      return NextResponse.json({ success: true })
    }

    if (action === "delete") {
      // Delete a signal by ID (clear the row)
      const sheetName = await getFirstSheetName(sheetsClient)
      const idRange = `${sheetName}!A:A`
      const fetchResponse = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: idRange,
      })
      const ids = fetchResponse.data.values || []
      let rowNumber = -1
      for (let i = 1; i < ids.length; i++) {
        if (ids[i][0] === body.id) {
          rowNumber = i + 1 // Google Sheets is 1-indexed
          break
        }
      }
      if (rowNumber === -1) {
        return NextResponse.json({ error: "Signal not found" }, { status: 404 })
      }
      const clearRange = `${sheetName}!A${rowNumber}:X${rowNumber}`
      await sheetsClient.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: clearRange,
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Sheets API error:", error)
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 })
  }
}
