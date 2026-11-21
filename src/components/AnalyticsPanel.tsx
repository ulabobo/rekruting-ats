"use client";

import React, { useState } from "react";
import {
  Award,
  BarChart3,
  Calendar,
  Clock,
  MoreHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import { AtsDatabase, Application, TrackType } from "@/types/ats";
import { TRACK_CONFIGS } from "@/lib/stages";

interface AnalyticsPanelProps {
  db: AtsDatabase;
}

const STAGE_RANK: Record<string, number> = {
  otklik: 1,
  call_screen: 2,
  rahbar_suhbati: 3,
  test_kuni: 4,
  amaliy_topshiriq: 4,
  offer: 5,
  hujjat_lms: 6,
};

function calcAvgTimeToFill(apps: Application[]): string {
  const hired = apps.filter((a) => a.status === "hired" && a.lmsTransferredAt);
  if (hired.length === 0) return "—";
  const totalDays = hired.reduce((sum, a) => {
    const start = new Date(a.appliedAt).getTime();
    const end = new Date(a.lmsTransferredAt!).getTime();
    return sum + Math.max(0.1, (end - start) / 86400000);
  }, 0);
  return `${(totalDays / hired.length).toFixed(1)} kun`;
}

export default function AnalyticsPanel({ db }: AnalyticsPanelProps) {
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>("all");

  const filteredApps =
    selectedRecruiterId === "all"
      ? db.applications
      : db.applications.filter((a) => a.assignedRecruiterId === selectedRecruiterId);

  const totalApps = filteredApps.length;
  const hiredApps = filteredApps.filter((a) => a.status === "hired").length;
  const conversionPct = totalApps > 0 ? Math.round((hiredApps / totalApps) * 100) : 0;
  const avgTimeToFill = calcAvgTimeToFill(filteredApps);

  const hasReachedStage = (a: Application, minRank: number) => {
    if (a.status === "hired") return true;
    return (STAGE_RANK[a.currentStage] || 1) >= minRank;
  };

  const funnelSteps = [
    {
      label: "1. Qiziqish bildirganlar",
      count: totalApps,
      color: "from-slate-600 to-slate-700",
    },
    {
      label: "2. Telefon suhbati",
      count: filteredApps.filter((a) => hasReachedStage(a, 2)).length,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "3. Rahbar bilan suhbat",
      count: filteredApps.filter((a) => hasReachedStage(a, 3)).length,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "4. 1 kunlik sinov kuni",
      count: filteredApps.filter((a) => hasReachedStage(a, 4)).length,
      color: "from-violet-500 to-purple-600",
    },
    {
      label: "5. Ish taklifi (Offer)",
      count: filteredApps.filter((a) => hasReachedStage(a, 5) || a.status === "offered").length,
      color: "from-blue-500 to-indigo-600",
    },
    {
      label: "6. Hujjatlar yuborildi",
      count: filteredApps.filter((a) => hasReachedStage(a, 6)).length,
      color: "from-cyan-600 to-teal-700",
    },
    {
      label: "7. Ishga qabul qilindi (Sheets)",
      count: hiredApps,
      color: "from-emerald-600 to-green-700",
    },
  ];

  const sourcesMap = new Map<string, number>();
  filteredApps.forEach((a) => {
    const c = db.candidates.find((x) => x.id === a.candidateId);
    if (c) sourcesMap.set(c.source, (sourcesMap.get(c.source) || 0) + 1);
  });

  const tracks: TrackType[] = [
    "dokon_xodimi",
    "dokon_rahbari",
    "ofis_xodimi",
    "ommaviy_yollash",
  ];

  // 7-kunlik kalendar: nechta ochildi (qizil) va nechtasi yopildi (yashil)
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    const dayNames = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    const sameDay = (iso?: string) =>
      iso ? new Date(iso).toDateString() === d.toDateString() : false;

    const openedCount = db.vacancies
      .filter((v) => sameDay(v.approvedAt))
      .reduce((s, v) => s + v.headcount, 0);

    const closedCount =
      db.applications.filter((a) => a.status === "hired" && sameDay(a.lmsTransferredAt)).length;

    return {
      date: d.getDate(),
      dayName: dayNames[d.getDay()],
      isToday: i === 3,
      openedCount,
      closedCount,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header + Recruiter Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Analitika va Rekruter KPI</h2>
          <p className="text-xs text-slate-500">
            Rekruterlar kesimidagi vizual voronka, Time to Fill va kunlik ochilgan/yopilgan vakansiyalar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
          <button
            onClick={() => setSelectedRecruiterId("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              selectedRecruiterId === "all"
                ? "bg-[#5865f2] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Umumiy holat
          </button>
          {db.users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedRecruiterId(u.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                selectedRecruiterId === u.id
                  ? "bg-[#5865f2] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {u.fullName.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400">Jami arizalar</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalApps}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-700">Ishga qabul qilindi</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{hiredApps}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-blue-700">Umumiy konversiya</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-700">{conversionPct}%</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-xs">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
            <Clock className="h-3.5 w-3.5" /> Time to Fill (KPI)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-indigo-700">{avgTimeToFill}</p>
        </div>
      </div>

      {/* Yo'nalishlar Kartochkalari */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tracks.map((tr, idx) => {
          const cfg = TRACK_CONFIGS[tr];
          const trApps = filteredApps.filter((a) => a.track === tr);
          const trVacs = db.vacancies.filter((v) => v.track === tr);
          const acceptedVacs = trVacs.filter(
            (v) => v.status === "accepted" || v.status === "closed"
          ).length;

          let progress = 0;
          if (trApps.length > 0) {
            const totalPct = trApps.reduce((sum, a) => {
              const sIdx = cfg.stages.findIndex((s) => s.id === a.currentStage);
              const pct =
                a.status === "hired"
                  ? 100
                  : sIdx >= 0
                  ? Math.round(((sIdx + 1) / cfg.stages.length) * 100)
                  : 15;
              return sum + pct;
            }, 0);
            progress = Math.round(totalPct / trApps.length);
          } else if (trVacs.length > 0) {
            progress = Math.round((acceptedVacs / trVacs.length) * 100);
          }

          const filledSegments = Math.max(progress > 0 ? 1 : 0, Math.round(progress / 10));
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
                  <div
                    title="Vakansiyalar"
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/20 bg-white/20 text-[10px] font-bold"
                  >
                    {trVacs.length}
                  </div>
                  <div
                    title="Nomzodlar"
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/20 bg-white/15 text-[10px] font-bold"
                  >
                    +{trApps.length}
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

      {/* Kalendar: Qizil (ochildi) va Yashil (yopildi) */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="border-b-2 border-slate-900 pb-3 -mb-3.5 text-slate-900">
              Kalendar (Haftalik oqim)
            </span>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
              ● Qizil: Ochildi
            </span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
              ● Yashil: Yopildi / Qabul qilindi
            </span>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-[#1b64f2]">
            {today.toLocaleDateString("ru-RU")}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {weekDays.map((d, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-2.5 transition ${
                d.isToday
                  ? "border-blue-200 bg-[#eef4ff] text-[#1b64f2]"
                  : "border-slate-100 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <p className="text-base font-extrabold">{d.date}</p>
              <p className="text-[11px] text-slate-400">{d.dayName}</p>
              <div className="mt-2 flex flex-col gap-1">
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  +{d.openedCount} ochildi
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  ✓{d.closedCount} yopildi
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Funnel + Sources */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50/70 to-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <BarChart3 className="h-4 w-4 text-[#5865f2]" />
                Rekruting Funnel (Vizual voronka)
              </h3>
              <p className="text-[11px] text-slate-500">
                Bosqichlar bo&apos;yicha aniq son va konversiya ko&apos;rsatkichi
              </p>
            </div>
            <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[11px] font-bold text-[#5865f2]">
              Jami: {totalApps} ta
            </span>
          </div>

          {(() => {
            // Find biggest drop-off step index
            let maxDropIdx = -1;
            let maxDropVal = 0;
            for (let i = 1; i < funnelSteps.length; i++) {
              const drop = funnelSteps[i - 1].count - funnelSteps[i].count;
              if (drop > maxDropVal) {
                maxDropVal = drop;
                maxDropIdx = i;
              }
            }
            const widths = [100, 90, 80, 70, 60, 52, 44];
            const styles = [
              "from-[#4f46e5] to-[#6366f1] text-white shadow-md shadow-indigo-200",
              "from-[#6366f1]/85 to-[#818cf8]/90 text-white shadow-sm",
              "from-[#818cf8]/70 to-[#a5b4fc]/80 text-slate-900 shadow-sm",
              "from-[#a5b4fc]/60 to-[#c7d2fe]/75 text-slate-900 shadow-sm",
              "from-[#60a5fa]/80 to-[#3b82f6]/90 text-white shadow-sm",
              "from-[#2dd4bf]/80 to-[#14b8a6]/90 text-white shadow-sm",
              "from-[#10b981] to-[#059669] text-white shadow-md shadow-emerald-200",
            ];

            return (
              <div className="space-y-2">
                {funnelSteps.map((step, idx) => {
                  const pct =
                    totalApps > 0 ? Math.round((step.count / totalApps) * 100) : 0;
                  const prevCount = idx > 0 ? funnelSteps[idx - 1].count : step.count;
                  const stepConv =
                    idx > 0 && prevCount > 0
                      ? Math.round((step.count / prevCount) * 100)
                      : 100;
                  const widthPct = widths[idx] ?? 44;

                  return (
                    <div key={step.label} className="flex items-center gap-3">
                      <div className="w-16 shrink-0 text-right text-[11px] font-bold text-slate-500">
                        Step {idx + 1}
                      </div>

                      <div className="flex flex-1 justify-center">
                        <div
                          className={`flex h-12 flex-col items-center justify-center bg-gradient-to-b ${styles[idx]} px-3 text-center transition-all duration-500`}
                          style={{
                            width: `${widthPct}%`,
                            clipPath: "polygon(0 0, 100% 0, 95% 100%, 5% 100%)",
                            borderRadius: "10px",
                          }}
                        >
                          <span className="truncate text-[10px] font-semibold opacity-90">
                            {step.label.replace(/^\d+\.\s*/, "")}
                          </span>
                          <span className="text-xs font-extrabold leading-tight">
                            {step.count} ta{" "}
                            <span className="text-[10px] font-semibold opacity-85">
                              ({pct}%)
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="w-28 shrink-0">
                        {idx === maxDropIdx && maxDropVal > 0 ? (
                          <span className="inline-block rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 shadow-2xs">
                            Eng katta yo&apos;qotish: -{maxDropVal}
                          </span>
                        ) : idx === funnelSteps.length - 1 ? (
                          <span className="inline-block rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-2xs">
                            Konversiya: {pct}%
                          </span>
                        ) : idx > 0 ? (
                          <span className="text-[10px] font-semibold text-slate-400">
                            O&apos;tish: {stepConv}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Nomzod manbalari (Sourcing)
          </h3>
          {sourcesMap.size === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Hali ma&apos;lumot yo&apos;q</p>
          ) : (
            <div className="space-y-3">
              {Array.from(sourcesMap.entries()).map(([src, cnt]) => {
                const pct = totalApps ? Math.round((cnt / totalApps) * 100) : 0;
                return (
                  <div key={src}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{src}</span>
                      <span className="font-bold text-slate-900">
                        {cnt} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rekruterlar kesimidagi batafsil KPI jadvali */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Users className="h-4 w-4 text-[#5865f2]" />
          Rekruterlar kesimidagi natijalar va Time to Fill KPI
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-semibold">Rekruter</th>
                <th className="pb-2.5 font-semibold">Qiziqish</th>
                <th className="pb-2.5 font-semibold">Qo&apos;ng&apos;iroq</th>
                <th className="pb-2.5 font-semibold">Rahbar suhbati</th>
                <th className="pb-2.5 font-semibold">Sinov kuni</th>
                <th className="pb-2.5 font-semibold">Ish taklifi</th>
                <th className="pb-2.5 font-semibold">Hujjatlar</th>
                <th className="pb-2.5 font-semibold text-emerald-700">Ishga qabul qilindi</th>
                <th className="pb-2.5 font-semibold text-indigo-700">Time to Fill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => {
                const uApps = db.applications.filter((a) => a.assignedRecruiterId === u.id);
                const uHired = uApps.filter((a) => a.status === "hired").length;
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedRecruiterId(u.id)}
                    className="cursor-pointer transition hover:bg-blue-50/40"
                  >
                    <td className="py-3 font-bold text-slate-900">{u.fullName}</td>
                    <td className="py-3">{uApps.length}</td>
                    <td className="py-3">{uApps.filter((a) => hasReachedStage(a, 2)).length}</td>
                    <td className="py-3">{uApps.filter((a) => hasReachedStage(a, 3)).length}</td>
                    <td className="py-3">{uApps.filter((a) => hasReachedStage(a, 4)).length}</td>
                    <td className="py-3">
                      {uApps.filter((a) => hasReachedStage(a, 5) || a.status === "offered").length}
                    </td>
                    <td className="py-3">{uApps.filter((a) => hasReachedStage(a, 6)).length}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                        <Award className="h-3 w-3" /> {uHired}
                      </span>
                    </td>
                    <td className="py-3 font-bold text-indigo-700">
                      {calcAvgTimeToFill(uApps)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
