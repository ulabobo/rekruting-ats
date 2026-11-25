import { NextRequest, NextResponse } from "next/server";
import { ATS_LMS_SECRET, HIRED_EMPLOYEE_KEYBOARD } from "@/lib/lms-integration";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = (req.headers.get("x-integration-key") || body.secret || "").trim();
    if (key !== ATS_LMS_SECRET) {
      return NextResponse.json({ error: "Noto'g'ri integratsiya kaliti" }, { status: 401 });
    }

    const chatId = String(body.chat_id || "").trim();
    const message = String(body.message || "").trim();
    if (!chatId || !message) {
      return NextResponse.json({ error: "chat_id va message talab qilinadi" }, { status: 400 });
    }

    const res = await sendTelegramMessage(
      chatId,
      message,
      body.show_employee_menu ? HIRED_EMPLOYEE_KEYBOARD : undefined
    );
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Server xatosi" },
      { status: 500 }
    );
  }
}
