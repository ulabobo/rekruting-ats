"use client";

import React, { useState } from "react";
import { AtsDatabase, Language } from "@/types/ats";
import { getStageLabel, getTrackTitle } from "@/lib/stages";
import { UI_TEXT } from "@/lib/i18n";

export default function AllCandidatesPanel({
  db,
  lang,
  onSelectApp,
}: {
  db: AtsDatabase;
  lang: Language;
  onSelectApp: (appId: string) => void;
}) {
  const t = UI_TEXT[lang];
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = db.applications.filter((a) => {
    if (statusFilter === "all") return true;
    return a.status === statusFilter;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t.allCandidatesTitle}</h2>
          <p className="text-xs text-slate-500">{t.allCandidatesSubtitle}</p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
          {[
            { id: "all", label: t.statusAll },
            { id: "active", label: t.statusActive },
            { id: "offered", label: t.statusOffered },
            { id: "reserved", label: t.statusReserved },
            { id: "hired", label: t.statusHired },
            { id: "rejected", label: t.statusRejected },
            { id: "blacklist", label: t.statusBlacklist },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            {lang === "ru" ? "Кандидаты не найдены" : "Nomzodlar topilmadi"}
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "ФИО" : "F.I.O"}</th>
                <th className="pb-2.5 font-semibold">{t.phoneLabel}</th>
                <th className="pb-2.5 font-semibold">{t.vacancyLabel}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Направление" : "Yo'nalish"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Этап" : "Bosqich"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Статус / Причина" : "Holat / Sabab"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((app) => {
                const cand = db.candidates.find((c) => c.id === app.candidateId);
                const vac = db.vacancies.find((v) => v.id === app.vacancyId);
                return (
                  <tr
                    key={app.id}
                    onClick={() => onSelectApp(app.id)}
                    className="cursor-pointer hover:bg-blue-50/40"
                  >
                    <td className="py-3 font-bold text-blue-700">{cand?.fullName}</td>
                    <td className="py-3 text-slate-600">{cand?.phone}</td>
                    <td className="py-3 text-slate-800">
                      {vac?.position} ({vac?.branch})
                    </td>
                    <td className="py-3 text-slate-500">{getTrackTitle(app.track, lang)}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {getStageLabel(app.track, app.currentStage, lang)}
                      </span>
                    </td>
                    <td className="py-3">
                      {app.status === "blacklist" ? (
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {t.statusBlacklist}: {app.rejectionReason || "—"}
                        </span>
                      ) : app.status === "reserved" ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          {t.statusReserved}
                        </span>
                      ) : app.status === "rejected" ? (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          {t.statusRejected}: {app.rejectionReason || "—"}
                        </span>
                      ) : app.status === "hired" ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {t.statusHired}
                        </span>
                      ) : (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          {app.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
