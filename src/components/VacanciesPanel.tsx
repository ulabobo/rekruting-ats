"use client";

import React from "react";
import { Banknote, Briefcase, Crown, Package, Plus } from "lucide-react";
import { AtsDatabase, Language, TrackType } from "@/types/ats";
import { getTrackTitle } from "@/lib/stages";

function HangerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 6a2 2 0 1 0-2-2c0 1.1.9 2 2 2v2" />
      <path d="M12 8 3.5 14.5a1.5 1.5 0 0 0 .9 2.7h15.2a1.5 1.5 0 0 0 .9-2.7L12 8Z" />
    </svg>
  );
}

function getPositionIcon(position: string, track: TrackType) {
  const p = position.toLowerCase();
  if (p.includes("sotuv") || p.includes("продавец") || p.includes("savdo")) {
    return <HangerIcon className="h-12 w-12 text-white/90" />;
  }
  if (p.includes("ombor") || p.includes("tovar") || p.includes("склад") || p.includes("товар")) {
    return <Package className="h-12 w-12 text-white/90" />;
  }
  if (p.includes("kassir") || p.includes("cashier") || p.includes("кассир") || p.includes("buxgalter")) {
    return <Banknote className="h-12 w-12 text-white/90" />;
  }
  if (
    track === "dokon_rahbari" ||
    p.includes("rahbar") ||
    p.includes("menejer") ||
    p.includes("direktor") ||
    p.includes("руковод")
  ) {
    return <Crown className="h-12 w-12 text-white/90" />;
  }
  return <Briefcase className="h-12 w-12 text-white/90" />;
}

const CARD_THEMES = [
  {
    bg: "from-[#4f86f7] to-[#3b6ff5]",
    pill: "bg-[#243bc7] text-white",
  },
  {
    bg: "from-[#4bb5ff] to-[#389bff]",
    pill: "bg-[#1a8fe3] text-white",
  },
  {
    bg: "from-[#ffb066] to-[#ff9442]",
    pill: "bg-[#e66a00] text-white",
  },
  {
    bg: "from-[#ff6b6b] to-[#ff4d57]",
    pill: "bg-[#d6000f] text-white",
  },
];

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
          <h2 className="text-xl font-extrabold text-slate-900">
            {lang === "ru" ? "Вакансии" : "Vakansiyalar"}
          </h2>
          <p className="text-xs text-slate-500">
            {lang === "ru"
              ? "Все открытые и закрытые вакансии с датой открытия"
              : "Barcha ochilgan vakansiyalar va ularning ochilish sanasi"}
          </p>
        </div>
        <button
          onClick={onOpenCreateVacancy}
          className="flex items-center gap-1.5 rounded-xl bg-[#5865f2] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-[#5865f2]/25 hover:bg-[#4752c4]"
        >
          <Plus className="h-4 w-4" />
          {lang === "ru" ? "Новая вакансия" : "Yangi vakansiya"}
        </button>
      </div>

      {db.vacancies.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-12 text-center text-sm text-slate-500">
          {lang === "ru"
            ? "Пока нет вакансий. Создайте новую или синхронизируйте штат."
            : "Hozircha vakansiyalar yo'q. Yangi vakansiya oching yoki shtatni tekshiring."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {db.vacancies.map((v, idx) => {
            const theme = CARD_THEMES[idx % CARD_THEMES.length];
            const openedDate = new Date(v.approvedAt).toLocaleDateString("ru-RU");
            const appsCount = db.applications.filter((a) => a.vacancyId === v.id).length;

            return (
              <div
                key={v.id}
                className={`relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bg} p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}
              >
                {/* Decorative top-right arc */}
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border border-white/25 bg-white/5" />

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold shadow-xs ${theme.pill}`}
                    >
                      {v.status === "open"
                        ? lang === "ru"
                          ? "Открыта"
                          : "Ochiq"
                        : lang === "ru"
                        ? "Закрыта"
                        : "Yopiq"}{" "}
                      • {openedDate}
                    </span>
                  </div>

                  <h3 className="text-lg font-extrabold leading-snug">{v.position}</h3>
                  <p className="mt-1 text-xs font-medium text-white/90">
                    {v.branch} ({v.city})
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/80">
                    {getTrackTitle(v.track, lang)} • {v.shift}
                  </p>
                </div>

                <div className="relative z-10 mt-4 space-y-1 text-xs">
                  <p className="font-bold text-white">{v.salaryBand}</p>
                  <p className="text-[11px] text-white/90">
                    {lang === "ru" ? "Штат:" : "Shtat:"} <b>{v.filledCount}/{v.headcount}</b> •{" "}
                    {lang === "ru" ? "Откликов:" : "Nomzodlar:"} <b>{appsCount}</b>
                  </p>
                </div>

                {/* Bottom-right glass arc with position icon (1-rasmdagidek) */}
                <div className="pointer-events-none absolute -bottom-5 -right-5 flex h-28 w-28 items-center justify-center rounded-full border border-white/35 bg-white/20 backdrop-blur-[2px]">
                  <div className="-translate-x-1.5 -translate-y-1.5">
                    {getPositionIcon(v.position, v.track)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
