"use client";

import React from "react";
import { BarChart3, Calendar, MoreHorizontal, TrendingUp } from "lucide-react";
import { AtsDatabase, TrackType } from "@/types/ats";
import { TRACK_CONFIGS } from "@/lib/stages";

interface AnalyticsPanelProps {
  db: AtsDatabase;
}

export default function AnalyticsPanel({ db }: AnalyticsPanelProps) {
  const totalApps = db.applications.length;
  const hiredApps = db.applications.filter((a) => a.status === "hired").length;
  const offeredApps = db.applications.filter(
    (a) => a.status === "offered" || a.status === "hired"
  ).length;

  const sourcesMap = new Map<string, number>();
  db.candidates.forEach((c) => {
    sourcesMap.set(c.source, (sourcesMap.get(c.source) || 0) + 1);
  });

  const tracks: TrackType[] = [
    "dokon_xodimi",
    "dokon_rahbari",
    "ofis_xodimi",
    "ommaviy_yollash",
  ];

  const funnelCounts = [
    { label: "Jami arizalar (Qiziqish)", count: totalApps, pct: 100 },
    {
      label: "Telefon suhbati / Baholangan",
      count: db.applications.filter((a) => a.currentStage !== "otklik").length,
      pct: totalApps
        ? Math.round(
            (db.applications.filter((a) => a.currentStage !== "otklik").length /
              totalApps) *
              100
          )
        : 0,
    },
    {
      label: "Rahbar bilan suhbat",
      count: db.applications.filter((a) =>
        ["rahbar_suhbati", "test_kuni", "offer", "hujjat_lms"].includes(
          a.currentStage
        )
      ).length,
      pct: totalApps
        ? Math.round(
            (db.applications.filter((a) =>
              ["rahbar_suhbati", "test_kuni", "offer", "hujjat_lms"].includes(
                a.currentStage
              )
            ).length /
              totalApps) *
              100
          )
        : 0,
    },
    {
      label: "Ish taklifi (Offer)",
      count: offeredApps,
      pct: totalApps ? Math.round((offeredApps / totalApps) * 100) : 0,
    },
    {
      label: "O'qitishga topshirildi",
      count: hiredApps,
      pct: totalApps ? Math.round((hiredApps / totalApps) * 100) : 0,
    },
  ];

  // Build 7-day calendar strip (3-rasmdagidek)
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const dayNames = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    return {
      date: d.getDate(),
      dayName: dayNames[d.getDay()],
      isToday: i === 3,
      count: db.applications.filter(
        (a) => new Date(a.appliedAt).toDateString() === d.toDateString()
      ).length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Analitika va KPI</h2>
        <p className="text-xs text-slate-500">
          Yo&apos;nalishlar kesimidagi jarayon, voronka konversiyasi va kalendar ko&apos;rsatkichlari
        </p>
      </div>

      {/* 3-rasm uslubidagi Yorqin Ko'k & Chuqur Qora Yo'nalish Kartochkalari */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tracks.map((tr, idx) => {
          const cfg = TRACK_CONFIGS[tr];
          const trApps = db.applications.filter((a) => a.track === tr);
          const trHired = trApps.filter((a) => a.status === "hired").length;
          const progress = trApps.length
            ? Math.round((trHired / trApps.length) * 100)
            : 0;
          const filledSegments = Math.max(
            progress > 0 ? 1 : 0,
            Math.round(progress / 10)
          );
          const isBlue = idx % 2 === 0;

          return (
            <div
              key={tr}
              className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg transition hover:-translate-y-0.5 ${
                isBlue
                  ? "bg-gradient-to-br from-[#1b64f2] to-[#1149c7]"
                  : "bg-gradient-to-br from-[#18181b] to-[#09090b]"
              }`}
            >
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-base font-bold leading-snug">{cfg.titleUz}</h3>
                <MoreHorizontal className="h-5 w-5 text-white/70" />
              </div>

              <div className="mb-1.5 flex items-center justify-between text-xs text-white/80">
                <span>Jarayon</span>
                <span className="font-bold text-white">{progress}%</span>
              </div>

              {/* 10-segment progress bar (3-rasmdagidek) */}
              <div className="mb-5 grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, sIdx) => (
                  <div
                    key={sIdx}
                    className={`h-1.5 rounded-full ${
                      sIdx < filledSegments ? "bg-white" : "bg-white/25"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex -space-x-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/20 bg-white/20 text-[10px] font-bold">
                    {trApps.length}
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/20 bg-white/15 text-[10px] font-bold">
                    +{trHired}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-white/85">
                  <Calendar className="h-3.5 w-3.5" />
                  {cfg.slaDays} kun
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Strip (3-rasm pastki qismi uslubida) */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex gap-6 text-xs font-bold">
            <span className="border-b-2 border-slate-900 pb-3 -mb-3.5 text-slate-900">
              Kalendar (Haftalik oqim)
            </span>
            <span className="text-slate-400">Jami arizalar: {totalApps}</span>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-[#1b64f2]">
            {today.toLocaleDateString("ru-RU")}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {weekDays.map((d, i) => (
            <div
              key={i}
              className={`rounded-2xl py-3 transition ${
                d.isToday
                  ? "bg-[#eef4ff] text-[#1b64f2]"
                  : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <p className="text-base font-extrabold">{d.date}</p>
              <p className="text-[11px] text-slate-400">{d.dayName}</p>
              <span
                className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  d.count > 0
                    ? "bg-[#1b64f2] text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {d.count} ta
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Funnel Conversion & Sources */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-[#1b64f2]" />
            Voronka konversiyasi
          </h3>
          <div className="space-y-3">
            {funnelCounts.map((step) => (
              <div key={step.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{step.label}</span>
                  <span className="font-bold text-slate-900">
                    {step.count} ({step.pct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#1b64f2] transition-all"
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Manbalar samaradorligi
          </h3>
          <div className="space-y-2.5">
            {sourcesMap.size === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Hozircha nomzodlar kiritilmagan
              </p>
            ) : (
              Array.from(sourcesMap.entries()).map(([source, count]) => (
                <div
                  key={source}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-xs"
                >
                  <span className="font-semibold text-slate-800">{source}</span>
                  <span className="rounded-full bg-blue-100 px-3 py-0.5 font-bold text-[#1b64f2]">
                    {count} nomzod
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
