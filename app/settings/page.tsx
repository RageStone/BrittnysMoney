"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SETTINGS_KEY = "trading-sl-tp-settings";

export default function SettingsPage() {
  const [slPct, setSlPct] = useState(1.0);
  const [tpPct, setTpPct] = useState(2.0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const { slPct, tpPct } = JSON.parse(savedSettings);
        if (typeof slPct === "number") setSlPct(slPct);
        if (typeof tpPct === "number") setTpPct(tpPct);
      } catch {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ slPct, tpPct }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle>SL/TP Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <label className="block text-gray-400 mb-1">Stop-Loss %</label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={slPct}
                onChange={e => setSlPct(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Take-Profit %</label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={tpPct}
                onChange={e => setTpPct(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <Button onClick={handleSave} className="w-full mt-2">
              Save
            </Button>
            {saved && <div className="text-green-400 text-center">Settings saved!</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 