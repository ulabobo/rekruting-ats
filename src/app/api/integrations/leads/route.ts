import { NextRequest, NextResponse } from "next/server";
import { createApplicationFromLead } from "@/lib/supabase-db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.phone || !body.fullName || !body.vacancyId) {
      return NextResponse.json(
        { error: "phone, fullName va vacancyId majburiy" },
        { status: 400 }
      );
    }

    const res = await createApplicationFromLead({
      phone: body.phone,
      fullName: body.fullName,
      vacancyId: body.vacancyId,
      source: body.source || "Sayt",
      birthDate: body.birthDate,
      address: body.address,
      experienceYears: body.experienceYears,
      education: body.education,
      telegramChatId: body.telegramChatId,
      telegramUsername: body.telegramUsername,
    });

    return NextResponse.json({
      ok: true,
      isDuplicate: res.isDuplicate,
      applicationId: res.applicationId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server xatosi" },
      { status: 500 }
    );
  }
}
