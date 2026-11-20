"use client";

import React, { useState } from "react";
import { Lock, LogIn, User as UserIcon } from "lucide-react";
import { Language, User } from "@/types/ats";
import { UI_TEXT } from "@/lib/i18n";

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
    <div className="flex min-h-screen items-center justify-center bg-[#f6f5f1] p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg font-black text-white">
              A
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">{t.appName}</h1>
              <p className="text-[11px] text-slate-500">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => onChangeLang("uz")}
              className={`rounded-md px-2.5 py-1 ${
                lang === "uz" ? "bg-blue-600 text-white" : "text-slate-600"
              }`}
            >
              UZ
            </button>
            <button
              type="button"
              onClick={() => onChangeLang("ru")}
              className={`rounded-md px-2.5 py-1 ${
                lang === "ru" ? "bg-blue-600 text-white" : "text-slate-600"
              }`}
            >
              RU
            </button>
          </div>
        </div>

        <h2 className="text-base font-bold text-slate-900">{t.loginTitle}</h2>
        <p className="mb-5 mt-1 text-xs text-slate-500">{t.loginSubtitle}</p>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {t.loginLabel}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {t.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "..." : t.loginButton}
          </button>
        </form>
      </div>
    </div>
  );
}
