import { NextResponse } from "next/server";
import { getFullDatabase, getSupabase, uid } from "@/lib/supabase-db";
import { isGoogleConfigured, syncDatabaseToGoogleSheets } from "@/lib/google-sheets";

export async function GET() {
  const db = await getFullDatabase();
  return NextResponse.json({
    configured: isGoogleConfigured(),
    spreadsheetId: db.settings.googleSpreadsheetId || process.env.GOOGLE_SPREADSHEET_ID || null,
    spreadsheetUrl: db.settings.googleSpreadsheetUrl || null,
    lastSyncAt: db.settings.googleLastSyncAt || null,
  });
}

export async function POST() {
  const db = await getFullDatabase();
  const status = await syncDatabaseToGoogleSheets(db);

  if (status.connected && status.spreadsheetId) {
    const sb = getSupabase();
    await sb
      .from("ats_settings")
      .upsert(
        {
          id: "default",
          data: {
            ...db.settings,
            googleSpreadsheetId: status.spreadsheetId,
            googleSpreadsheetUrl: status.spreadsheetUrl,
            googleLastSyncAt: status.lastSyncAt,
          },
        },
        { onConflict: "id" }
      );
    await sb.from("ats_integration_events").insert({
      id: uid("evt"),
      direction: "outbound",
      system: "GoogleSheets",
      event_type: "SHEETS_SYNC",
      payload_summary: `Rekrut ATS (${status.spreadsheetId}) sinxronizatsiya qilindi`,
      status: "success",
    });
  }

  return NextResponse.json(status);
}
