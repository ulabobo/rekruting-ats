import { NextResponse } from "next/server";
import { syncErpStaffingRows } from "@/lib/supabase-db";
import { ErpStaffingRow, TrackType } from "@/types/ats";

const SHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID || "1YA4_0soHhRSBpeyVkNq9LatOWsi_Pj6XR5yKnwm9QA4";

const TABS = ["Aura-1", "Aura-2", "Aura-3", "Aura-4", "Bosh ofis", "Toshkent ombor"];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function mapTrack(raw: string | undefined, position: string, tab: string): TrackType {
  const val = (raw || "").toLowerCase().trim();
  if (val.includes("rahbar") || val === "dokon_rahbari") return "dokon_rahbari";
  if (val.includes("ofis") || val === "ofis_xodimi") return "ofis_xodimi";
  if (val.includes("ommaviy") || val === "ommaviy_yollash") return "ommaviy_yollash";
  if (val.includes("xodim") || val === "dokon_xodimi") return "dokon_xodimi";

  const pos = position.toLowerCase();
  if (pos.includes("menejer") || pos.includes("supervayzer") || pos.includes("rahbar") || pos.includes("direktor")) {
    return "dokon_rahbari";
  }
  if (tab === "Bosh ofis") return "ofis_xodimi";
  return "dokon_xodimi";
}

let lastPollAt = 0;
let pollInProgress = false;

export async function POST() {
  const now = Date.now();
  if (pollInProgress || now - lastPollAt < 45000) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  pollInProgress = true;
  lastPollAt = now;
  try {
    const collected: Omit<ErpStaffingRow, "id" | "updatedAt">[] = [];
    let anyReadable = false;

    for (const tab of TABS) {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        tab
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;

      const text = await res.text();
      if (text.trim().startsWith("<")) continue;
      anyReadable = true;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) continue;

      // Sarlavha qatorini avtomatik aniqlash (LAVOZIM / SHTAT / BAND yoki Viloyat / Lavozim / Plan / Fakt)
      let idxPos = 2;
      let idxPlan = 4;
      let idxFact = 5;
      let idxRegion = 0;
      let idxCity = 1;
      let idxTrack = 3;
      let idxShift = 6;
      let startRow = 0;

      for (let r = 0; r < Math.min(5, lines.length); r++) {
        const cols = parseCsvLine(lines[r]).map((c) => c.toLowerCase().trim());
        const foundPos = cols.findIndex((c) => c.includes("lavozim"));
        if (foundPos !== -1) {
          idxPos = foundPos;
          const fPlan = cols.findIndex((c) => c.includes("shtat") || c.includes("plan"));
          const fFact = cols.findIndex((c) => c.includes("band") || c.includes("fakt"));
          const fReg = cols.findIndex((c) => c.includes("viloyat"));
          const fCity = cols.findIndex((c) => c.includes("shahar"));
          const fTrack = cols.findIndex((c) => c.includes("yonalish") || c.includes("yo'nalish"));
          const fShift = cols.findIndex((c) => c.includes("smena"));
          if (fPlan !== -1) idxPlan = fPlan;
          if (fFact !== -1) idxFact = fFact;
          if (fReg !== -1) idxRegion = fReg;
          if (fCity !== -1) idxCity = fCity;
          if (fTrack !== -1) idxTrack = fTrack;
          if (fShift !== -1) idxShift = fShift;
          startRow = r + 1;
          break;
        }
      }

      for (let i = startRow; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const position = (cols[idxPos] || "").replace(/\s+/g, " ").trim();
        if (!position) continue;

        const planCount = Number(cols[idxPlan]) || 0;
        const factCount = Number(cols[idxFact]) || 0;
        if (planCount === 0 && factCount === 0) continue;

        collected.push({
          sheetTab: tab,
          region: cols[idxRegion] || "Toshkent shahri",
          city: cols[idxCity] || "Toshkent",
          branch: tab,
          position,
          track: mapTrack(cols[idxTrack], position, tab),
          planCount,
          factCount,
          shift: cols[idxShift] || "2/2 smena",
          salaryBand: "Shtat bo'yicha",
        });
      }
    }

    if (!anyReadable) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google Sheets fayli yopiq (Private). Uni 'Share → Anyone with the link (Viewer)' qiling.",
        },
        { status: 403 }
      );
    }

    const res = await syncErpStaffingRows(collected);
    return NextResponse.json({
      ok: true,
      checkedRows: collected.length,
      openedVacancies: res.openedVacancies,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Xatolik" },
      { status: 500 }
    );
  } finally {
    pollInProgress = false;
  }
}
