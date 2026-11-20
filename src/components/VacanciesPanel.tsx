"use client";

import React from "react";
import { Briefcase, Clock, Plus } from "lucide-react";
import { AtsDatabase, Language } from "@/types/ats";
import { getTrackTitle } from "@/lib/stages";

export default function VacanciesPanel({
  db,
  lang,
  onOpenCreateVacancy,
}: {
  db: AtsDatabase;
  lang: Language;
  onOpenCreateVacancy: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {lang === "ru" ? "Вакансии" : "Vakansiyalar"}
          </h2>
          <p className="text-xs text-slate-500">
            {lang === "ru"
              ? "Все открытые и закрытые вакансии (включая штат из Sheets ERP)"
              : "Barcha ochiq va yopiq vakansiyalar (Sheets ERP shtatidan kelganlar bilan)"}
          </p>
        </div>
        <button
          onClick={onOpenCreateVacancy}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {lang === "ru" ? "Новая вакансия" : "Yangi vakansiya"}
        </button>
      </div>

      {db.vacancies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {lang === "ru"
            ? "Пока нет вакансий. Создайте новую или синхронизируйте штат из Sheets (ERP)."
            : "Hozircha vakansiyalar yo'q. Yangi vakansiya oching yoki Sheets (ERP) shtatini tekshiring."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {db.vacancies.map((v) => {
            const daysOpen = Math.floor(
              (Date.now() - new Date(v.approvedAt).getTime()) / 86400000
            );
            const isOverdue = v.status === "open" && daysOpen > v.slaDays;
            const appsCount = db.applications.filter((a) => a.vacancyId === v.id).length;

            return (
              <div
                key={v.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    {getTrackTitle(v.track, lang)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      v.status === "open"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {v.status === "open"
                      ? lang === "ru"
                        ? "Открыта"
                        : "Ochiq"
                      : lang === "ru"
                      ? "Закрыта"
                      : "Yopiq"}
                  </span>
                </div>

                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  {v.position}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {v.branch} • {v.shift}
                </p>
                <p className="mt-2 text-xs font-semibold text-emerald-700">{v.salaryBand}</p>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="font-semibold text-slate-700">
                    {lang === "ru" ? "Штат:" : "Shtat:"} {v.filledCount} / {v.headcount}
                  </span>
                  <span className="text-slate-500">
                    {lang === "ru" ? "Откликов:" : "Arizalar:"} <b>{appsCount}</b>
                  </span>
                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      isOverdue ? "text-rose-600" : "text-slate-500"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {daysOpen} / {v.slaDays}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
