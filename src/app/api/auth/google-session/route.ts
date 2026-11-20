import { NextRequest, NextResponse } from "next/server";
import { authenticateByEmail, getSupabase } from "@/lib/supabase-db";

export async function POST(req: NextRequest) {
  try {
    const { accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: "Token topilmadi" }, { status: 400 });
    }

    const sb = getSupabase();
    const { data: authData, error } = await sb.auth.getUser(accessToken);
    if (error || !authData.user?.email) {
      return NextResponse.json({ error: "Google sessiyasi tasdiqlanmadi" }, { status: 401 });
    }

    const user = await authenticateByEmail(authData.user.email);
    if (!user) {
      return NextResponse.json(
        {
          error: `${authData.user.email} hisobiga Rekruting ATS da ruxsat berilmagan. Admin orqali rekruter qo'shing.`,
        },
        { status: 403 }
      );
    }

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set("aura_uid", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server xatosi" },
      { status: 500 }
    );
  }
}
