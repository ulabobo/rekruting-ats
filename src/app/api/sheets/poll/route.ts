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

export async function POST() {
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
      if (text.trim().startsWith("<")) continue; // login HTML page (private sheet)
      anyReadable = true;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      for (let i = 0; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols[0]?.toLowerCase() === "viloyat" || cols[2]?.toLowerCase() === "lavozim") {
          continue;
        }
        const position = cols[2];
        if (!position) continue;

        const planCount = Number(cols[4]) || 0;
        const factCount = Number(cols[5]) || 0;

        collected.push({
          sheetTab: tab,
          region: cols[0] || "Toshkent shahri",
          city: cols[1] || "Toshkent",
          branch: tab,
          position,
          track: (cols[3] as TrackType) || (tab === "Bosh ofis" ? "ofis_xodimi" : "dokon_xodimi"),
          planCount,
          factCount,
          shift: cols[6] || "2/2 smena",
          salaryBand: "Shtat bo'yicha",
        });
      }
    }

    if (!anyReadable) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google Sheets fayli yopiq (Private). Uni 'Share → Anyone with the link (Viewer)' qiling yoki Apps Script qo'ying.",
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
  }
}
