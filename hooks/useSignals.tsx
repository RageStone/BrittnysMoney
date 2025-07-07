import { useState, useEffect, useCallback } from "react"
import { parseSignal, filterValidSignals, Signal } from "@/lib/utils"
import { toast } from "sonner"

export function useSignals() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string>("")
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Load signals from Google Sheets
  const loadSignalsFromSheets = useCallback(async () => {
    try {
      setIsSyncing(true)
      const response = await fetch("/api/sheets?action=fetch")
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to load from sheets")
      }
      const data = await response.json()
      if (data.signals && data.signals.length > 0) {
        const parsed = data.signals.map(parseSignal) as (Signal | null)[]
        const valid = filterValidSignals(parsed)
        if (valid.length < parsed.length) {
          toast.error("חלק מהאותות מהגוגל שיטס לא נטענו עקב נתונים חסרים/שגויים.")
        }
        setSignals(valid)
        setLastSyncTime(new Date())
        toast.success("סונכרן בהצלחה מהגוגל שיטס!")
      } else {
        toast("לא נמצאו אותות חדשים בגוגל שיטס.")
      }
    } catch (error: any) {
      setError(error.message || "שגיאה בסנכרון עם גוגל שיטס")
      // Fallback to localStorage if sheets fail
      const savedSignals = localStorage.getItem("brittnys-money-signals")
      if (savedSignals) {
        try {
          const parsed = JSON.parse(savedSignals).map(parseSignal) as (Signal | null)[]
          const valid = filterValidSignals(parsed)
          if (valid.length < parsed.length) {
            toast.error("חלק מהאותות מהיסטוריית הדפדפן לא נטענו עקב נתונים חסרים/שגויים.")
          }
          if (valid.length > 0) {
            setSignals(valid)
            toast("נטען מהיסטוריית הדפדפן.")
          }
        } catch (error) {
          // ignore
        }
      }
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // Save signal to Google Sheets
  const saveSignalToSheets = useCallback(async (signal: Signal, isUpdate = false) => {
    try {
      setIsSyncing(true)
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isUpdate ? "update" : "add",
          signal,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to save to sheets")
      }
      toast.success(isUpdate ? "עודכן בהצלחה בגוגל שיטס!" : "נשמר בהצלחה בגוגל שיטס!")
    } catch (error: any) {
      toast.error(error.message || "שגיאה בשמירה לגוגל שיטס, נשמר מקומית בלבד.")
      localStorage.setItem("brittnys-money-signals", JSON.stringify(signals))
    } finally {
      setIsSyncing(false)
    }
  }, [signals])

  // Delete signal
  const handleDeleteSignal = useCallback(async (id: string) => {
    try {
      setSignals((prev) => prev.filter((s) => s.id !== id))
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "שגיאה במחיקת האות מהגוגל שיטס.")
      }
      toast.success("האות נמחק בהצלחה!")
      localStorage.setItem("brittnys-money-signals", JSON.stringify(signals.filter((s) => s.id !== id)))
    } catch (error: any) {
      toast.error(error.message || "שגיאה במחיקת האות.")
    }
  }, [signals])

  // Edit signal
  const handleEditSignal = useCallback(async (updated: Signal) => {
    try {
      setSignals((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      await saveSignalToSheets(updated, true)
      toast.success("האות עודכן בהצלחה!")
    } catch (error: any) {
      toast.error(error.message || "שגיאה בעדכון האות.")
    }
  }, [saveSignalToSheets])

  useEffect(() => {
    loadSignalsFromSheets()
  }, [loadSignalsFromSheets])

  return {
    signals,
    setSignals,
    isSyncing,
    error,
    lastSyncTime,
    loadSignalsFromSheets,
    saveSignalToSheets,
    handleDeleteSignal,
    handleEditSignal,
    setError,
  }
} 