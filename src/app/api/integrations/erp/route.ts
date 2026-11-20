import { NextRequest, NextResponse } from "next/server";
import {
  createVacancy,
  getFullDatabase,
  syncErpStaffingRows,
} from "@/lib/supabase-db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.eventType === "ERP_STAFFING_SYNC" && Array.isArray(body.rows)) {
      const res = await syncErpStaffingRows(body.rows);
      const db = await getFullDatabase();
      return NextResponse.json({ ok: true, openedVacancies: res.openedVacancies, db });
    }

    if (body.eventType === "VACANCY_APPROVED") {
      await createVacancy({
        track: body.track || "dokon_xodimi",
        branch: body.branch || "Filial",
        position: body.position || "Sotuvchi",
        shift: body.shift || "2/2 smena",
        salaryBand: body.salaryBand || "Kelishiladi",
        headcount: Number(body.headcount) || 1,
        hiringManagerName: body.hiringManagerName || "Sheets ERP",
        responsibleRecruiterId: body.responsibleRecruiterId || "u-admin",
        erpRequestId: body.erpRequestId || `ERP-${Date.now().toString().slice(-4)}`,
        actorName: "Sheets ERP",
      });
      const db = await getFullDatabase();
      return NextResponse.json({ ok: true, db });
    }

    return NextResponse.json({ error: "Noto'g'ri eventType" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server xatosi" },
      { status: 500 }
    );
  }
}
