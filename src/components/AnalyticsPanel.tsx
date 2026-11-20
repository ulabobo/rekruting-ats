"use client";

import React from "react";
import { BarChart3, Clock, Target, TrendingUp, Users } from "lucide-react";
import { AtsDatabase, TrackType } from "@/types/ats";
import { TRACK_CONFIGS } from "@/lib/stages";

interface AnalyticsPanelProps {
  db: AtsDatabase;
}

export default function AnalyticsPanel({ db }: AnalyticsPanelProps) {
  const totalApps = db.applications.length;
  const hiredApps = db.applications.filter((a) => a.status === "hired").length;
  const offeredApps = db.applications.filter((a) => a.status === "offered" || a.status === "hired").length;
  const duplicateApps = db.applications.filter((a) => a.isDuplicateWarning).length;

  const sourcesMap = new Map<string, number>();
  db.candidates.forEach((c) => {
    sourcesMap.set(c.source, (sourcesMap.get(c.source) || 0) + 1);
  });

  const tracks: TrackType[] = ["dokon_xodimi", "dokon_rahbari", "ofis_xodimi", "ommaviy_yollash"];

  const funnelCounts = [
    { label: "Jami arizalar (Otklik)", count: totalApps, pct: 100 },
    {
      label: "Call Screen / Baholangan",
      count: db.applications.filter((a) => a.currentStage !== "otklik").length,
      pct: totalApps ? Math.round((db.applications.filter((a) => a.currentStage !== "otklik").length / totalApps) * 100) : 0,
    },
    {
      label: "Rahbar bilan suhbat",
      count: db.applications.filter((a) =>
        ["rahbar_suhbati", "test_kuni", "offer", "hujjat_lms"].includes(a.currentStage)
      ).length,
      pct: totalApps
        ? Math.round(
            (db.applications.filter((a) =>
              ["rahbar_suhbati", "test_kuni", "offer", "hujjat_lms"].includes(a.currentStage)
            ).length /
              totalApps) *
              100
          )
        : 0,
    },
    {
      label: "Offer yuborilgan",
      count: offeredApps,
      pct: totalApps ? Math.round((offeredApps / totalApps) * 100) : 0,
    },
    {
      label: "LMS ga topshirildi (Ishga chiqdi)",
      count: hiredApps,
      pct: totalApps ? Math.round((hiredApps / totalApps) * 100) : 0,
    },
  ];

  const qualityKpis = [
    {
      group: "Do'kon xodimlari",
      metrics: [
        { name: "90 kundan keyin qolganlar", target: "≥ 75%", current: "78%", ok: true },
        { name: "Tavsiya orqali kelganlar", target: "≥ 20%", current: "24%", ok: true },
      ],
    },
    {
      group: "Do'kon rahbariyati",
      metrics: [
        { name: "Ichkaridan tayinlanganlar", target: "≥ 50%", current: "55%", ok: true },
        { name: "Sinov muddatidan o'tganlar", target: "≥ 90%", current: "92%", ok: true },
      ],
    },
    {
      group: "Ofis xodimlari",
      metrics: [
        { name: "Sinov muddatidan o'tganlar", target: "≥ 85%", current: "88%", ok: true },
        { name: "Taklifni (Offer) qabul qilganlar", target: "≥ 80%", current: "84%", ok: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Shaffof Analitika va KPI Paneli</h2>
        <p className="text-sm text-slate-500">
          Voronka konversiyasi, Time to Fill va sifat ko&apos;rsatkichlari (full-hr.netlify.app asosida)
        </p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Jami arizalar</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{totalApps}</p>
          <p className="mt-1 text-xs text-slate-500">
            Shundan takroriy murojaatlar: <span className="font-semibold text-amber-600">{duplicateApps}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Ochiq vakansiyalar</span>
            <Target className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {db.vacancies.filter((v) => v.status === "open").length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Jami kerakli shtat:{" "}
            <span className="font-semibold text-slate-800">
              {db.vacancies.reduce((s, v) => s + v.headcount, 0)}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Offer / LMS Handoff</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600">
            {offeredApps} / {hiredApps}
          </p>
          <p className="mt-1 text-xs text-slate-500">Offer va ishga chiqqanlar</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">SLA buzilgan vakansiyalar</span>
            <Clock className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-rose-600">
            {
              db.vacancies.filter((v) => {
                const days = Math.floor(
                  (Date.now() - new Date(v.approvedAt).getTime()) / 86400000
                );
                return v.status === "open" && days > v.slaDays;
              }).length
            }
          </p>
          <p className="mt-1 text-xs text-slate-500">Tezkor e&apos;tibor talab qiladi</p>
        </div>
      </div>

      {/* Funnel Conversion + Time to Fill */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-blue-600" />
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
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all"
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Time to Fill (Yo&apos;nalishlar kesimida)
          </h3>
          <div className="space-y-3">
            {tracks.map((tr) => {
              const cfg = TRACK_CONFIGS[tr];
              const vacs = db.vacancies.filter((v) => v.track === tr);
              const avgDays = vacs.length
                ? Math.round(
                    vacs.reduce(
                      (s, v) =>
                        s + Math.floor((Date.now() - new Date(v.approvedAt).getTime()) / 86400000),
                      0
                    ) / vacs.length
                  )
                : 0;
              const isOk = avgDays <= cfg.slaDays;
              return (
                <div
                  key={tr}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{cfg.titleUz}</p>
                    <p className="text-[11px] text-slate-500">{cfg.slaLabelUz}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      O&apos;rtacha: {avgDays} kun
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sources & Quality KPIs */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Manbalar samaradorligi</h3>
          <div className="space-y-2.5">
            {Array.from(sourcesMap.entries()).map(([source, count]) => (
              <div
                key={source}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <span className="font-semibold text-slate-800">{source}</span>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-700">
                  {count} nomzod
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Sifat KPI lari</h3>
          <div className="space-y-3">
            {qualityKpis.map((g) => (
              <div key={g.group} className="rounded-xl border border-slate-100 p-3">
                <p className="mb-2 text-xs font-bold text-blue-700">{g.group}</p>
                <div className="space-y-1.5">
                  {g.metrics.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Maqsad: {m.target}</span>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                          {m.current}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
