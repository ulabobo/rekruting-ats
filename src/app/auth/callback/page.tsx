"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Hash (#access_token=...) yoki code (?code=...) dan sessiyani olish
      const { data } = await sb.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setError("Google avtorizatsiyasi yakunlanmadi. Qaytadan urinib ko'ring.");
        return;
      }

      const res = await fetch("/api/auth/google-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Ruxsat berilmadi.");
        return;
      }

      router.replace("/");
    };

    run();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3fc] p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        {error ? (
          <>
            <p className="text-sm font-bold text-rose-600">{error}</p>
            <button
              onClick={() => router.replace("/")}
              className="mt-4 rounded-xl bg-[#5865f2] px-5 py-2 text-xs font-bold text-white"
            >
              Kirish sahifasiga qaytish
            </button>
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-600">
            Google hisobingiz tekshirilmoqda...
          </p>
        )}
      </div>
    </div>
  );
}
