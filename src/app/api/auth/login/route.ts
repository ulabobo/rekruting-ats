import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/supabase-db";

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();
    if (!login || !password) {
      return NextResponse.json({ error: "Login va parol kiriting" }, { status: 400 });
    }
    const user = await authenticateUser(login, password);
    if (!user) {
      return NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 401 });
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
