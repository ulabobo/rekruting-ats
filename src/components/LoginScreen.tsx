"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Language, User } from "@/types/ats";
import { UI_TEXT } from "@/lib/i18n";
import ParticleBackground from "@/components/ParticleBackground";

export default function LoginScreen({
  lang,
  onChangeLang,
  onLoginSuccess,
}: {
  lang: Language;
  onChangeLang: (l: Language) => void;
  onLoginSuccess: (user: User) => void;
}) {
  const t = UI_TEXT[lang];
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.loginError);
      } else {
        onLoginSuccess(data.user);
      }
    } catch {
      setError(t.loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4"
      style={{
        background:
          "radial-gradient(circle at 12% 85%, #6c72ff 0%, transparent 48%), radial-gradient(circle at 30% 15%, #4ea5ff 0%, transparent 50%), radial-gradient(circle at 90% 45%, #c7e2f8 0%, #dbeafe 100%)",
      }}
    >
      <ParticleBackground intense />

      {/* Top bar: Language switcher */}
      <div className="relative z-10 mb-6 flex w-full max-w-md items-center justify-between px-2">
        <div className="flex items-center gap-2.5 text-white">
          <img
            src="/logo.png?v=2"
            alt="Rekruting ATS"
            className="h-9 w-9 rounded-xl object-cover shadow-md"
          />
          <span className="text-sm font-bold tracking-wide">{t.appName}</span>
        </div>

        <div className="flex rounded-xl bg-white/25 p-0.5 text-xs font-bold text-white backdrop-blur-md">
          <button
            type="button"
            onClick={() => onChangeLang("uz")}
            className={`rounded-lg px-2.5 py-1 transition ${
              lang === "uz" ? "bg-white text-[#5865f2]" : "text-white/90 hover:text-white"
            }`}
          >
            UZ
          </button>
          <button
            type="button"
            onClick={() => onChangeLang("ru")}
            className={`rounded-lg px-2.5 py-1 transition ${
              lang === "ru" ? "bg-white text-[#5865f2]" : "text-white/90 hover:text-white"
            }`}
          >
            RU
          </button>
        </div>
      </div>

      {/* Center White Card (Rasmdagidek) */}
      <div className="relative z-10 w-full max-w-[400px] rounded-3xl bg-white px-8 py-9 shadow-[0_24px_60px_rgba(30,58,138,0.16)]">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">
            {lang === "ru" ? "Добро пожаловать!" : "Xush kelibsiz!"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">{t.loginSubtitle}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-center text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t.loginLabel}
            </label>
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder={lang === "ru" ? "Введите логин" : "Loginingizni kiriting"}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#5865f2] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#5865f2] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label="Parolni ko'rish"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[#5865f2] py-2.5 text-sm font-bold text-white shadow-md shadow-[#5865f2]/25 transition hover:bg-[#4752c4] disabled:opacity-50"
          >
            {loading ? "..." : t.loginButton}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError("");
              const sb = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              const { error: oauthErr } = await sb.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
              if (oauthErr) setError(oauthErr.message);
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.73-2.48 1.16-4.22 1.16-3.24 0-5.98-2.19-6.96-5.13H1.03v3.14C3.04 21.15 7.21 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.04 14.02c-.25-.73-.39-1.52-.39-2.34 0-.82.14-1.61.39-2.34V6.2H1.03C.37 7.51 0 9.01 0 10.68s.37 3.17 1.03 4.48l4.01-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.79 0 3.4.62 4.67 1.82l3.5-3.5C18.07 1.12 15.29 0 12 0 7.21 0 3.04 2.85 1.03 7.06l4.01 3.14c.98-2.94 3.72-5.13 6.96-5.13Z"
              />
            </svg>
            {lang === "ru" ? "Войти через Google" : "Google bilan kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
