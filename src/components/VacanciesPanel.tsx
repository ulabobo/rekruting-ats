"use client";

import React, { useMemo, useState } from "react";
import {
  Banknote,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Filter,
  LayoutGrid,
  Package,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";
import { AtsDatabase, Language, TrackType, User } from "@/types/ats";
import { TRACK_CONFIGS, getTrackTitle } from "@/lib/stages";

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
    p.includes("supervayzer") ||
    p.includes("руковод")
  ) {
    return <Crown className="h-12 w-12 text-white/90" />;
  }
  return <Briefcase className="h-12 w-12 text-white/90" />;
}

const CARD_THEMES = [
  { bg: "from-[#4f86f7] to-[#3b6ff5]", pill: "bg-[#243bc7] text-white" },
  { bg: "from-[#4bb5ff] to-[#389bff]", pill: "bg-[#1a8fe3] text-white" },
  { bg: "from-[#ffb066] to-[#ff9442]", pill: "bg-[#e66a00] text-white" },
  { bg: "from-[#ff6b6b] to-[#ff4d57]", pill: "bg-[#d6000f] text-white" },
];

interface VacFilterState {
  branches: string[];
  tracks: TrackType[];
  statuses: string[];
}

export default function VacanciesPanel({
  db,
  currentUser,
  lang,
  onOpenCreateVacancy,
  onUpdateDb,
}: {
  db: AtsDatabase;
  currentUser: User;
  lang: Language;
  onOpenCreateVacancy: () => void;
  onUpdateDb: (db: AtsDatabase) => void;
}) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [vacancyTab, setVacancyTab] = useState<"active" | "closed">("active");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<VacFilterState>({
    branches: [],
    tracks: [],
    statuses: [],
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<VacFilterState>(filters);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const realVacancies = useMemo(
    () => db.vacancies.filter((v) => !v.id.startsWith("vac-res-") && !v.id.startsWith("vac-city-")),
    [db.vacancies]
  );

  const branches = useMemo(
    () => Array.from(new Set(realVacancies.map((v) => v.branch))),
    [realVacancies]
  );

  const filtered = useMemo(() => {
    return realVacancies.filter((v) => {
      if (vacancyTab === "active" && v.status === "closed") return false;
      if (vacancyTab === "closed" && v.status !== "closed") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !v.position.toLowerCase().includes(q) &&
          !v.branch.toLowerCase().includes(q) &&
          !v.city.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.branches.length > 0 && !filters.branches.includes(v.branch)) return false;
      if (filters.tracks.length > 0 && !filters.tracks.includes(v.track)) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(v.status)) return false;
      return true;
    });
  }, [realVacancies, vacancyTab, search, filters]);

  // Top Analytics stats dynamically calculated by headcount (shtat soni) from filtered vacancies!
  const totalHeadcount = filtered.reduce((s, v) => s + v.headcount, 0);
  const openHeadcount = filtered
    .filter((v) => v.status === "open")
    .reduce((s, v) => s + v.headcount, 0);
  const acceptedHeadcount = filtered
    .filter((v) => v.status === "accepted")
    .reduce((s, v) => s + v.headcount, 0);
  const closedOrFilledHeadcount = filtered.reduce(
    (s, v) => s + (v.status === "closed" ? v.headcount : v.filledCount),
    0
  );

  const activeFilterCount =
    filters.branches.length + filters.tracks.length + filters.statuses.length;

  const toggleArr = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleAcceptVacancy = async (vacancyId: string) => {
    setAcceptingId(vacancyId);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept_vacancy",
          vacancyId,
          recruiterId: currentUser.id,
          recruiterName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (data.db) onUpdateDb(data.db);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCloseVacancy = async (vacancyId: string) => {
    if (
      !window.confirm(
        lang === "ru"
          ? "Закрыть вакансию и уведомить остальных кандидатов в Telegram?"
          : "Vakansiyani yopib, qolgan nomzodlarga Telegram orqali zaxira so'rovi yuborilsinmi?"
      )
    ) {
      return;
    }
    setAcceptingId(vacancyId);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_vacancy",
          vacancyId,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (data.db) onUpdateDb(data.db);
    } finally {
      setAcceptingId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "accepted") return lang === "ru" ? "Принята" : "Qabul qilindi";
    if (status === "open") return lang === "ru" ? "Новая" : "Yangi";
    if (status === "closed") return lang === "ru" ? "Закрыта" : "Yopiq";
    return status;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {lang === "ru" ? "Вакансии" : "Vakansiyalar"}
          </h2>
          <p className="text-xs text-slate-500">
            {lang === "ru"
              ? "Аналитика, принятие вакансий рекрутером и управление"
              : "Yuqori analitika, vakansiyalarni qabul qilish va boshqarish"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold">
            <button
              onClick={() => setVacancyTab("active")}
              className={`rounded-lg px-3 py-1.5 ${
                vacancyTab === "active" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              {lang === "ru" ? "Активные" : "Faol"} (
              {db.vacancies.filter((v) => v.status !== "closed").length})
            </button>
            <button
              onClick={() => setVacancyTab("closed")}
              className={`rounded-lg px-3 py-1.5 ${
                vacancyTab === "closed" ? "bg-emerald-600 text-white" : "text-slate-600"
              }`}
            >
              {lang === "ru" ? "Закрытые" : "Yopilganlar"} (
              {db.vacancies.filter((v) => v.status === "closed").length})
            </button>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                viewMode === "cards" ? "bg-[#5865f2] text-white" : "text-slate-600"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {lang === "ru" ? "Карточки" : "Kartochka"}
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                viewMode === "table" ? "bg-[#5865f2] text-white" : "text-slate-600"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              {lang === "ru" ? "Таблица" : "Jadval"}
            </button>
          </div>

          <button
            onClick={onOpenCreateVacancy}
            className="flex items-center gap-1.5 rounded-xl bg-[#5865f2] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-[#5865f2]/25 hover:bg-[#4752c4]"
          >
            <Plus className="h-4 w-4" />
            {lang === "ru" ? "Новая вакансия" : "Yangi vakansiya"}
          </button>
        </div>
      </div>

      {/* Top Analytics Row (Shtat sonlari bo'yicha, filterga moslashadi!) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400">
            {lang === "ru" ? "Всего мест (штат)" : "Jami bo'sh o'rinlar (shtat)"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{totalHeadcount}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-amber-700">
            {lang === "ru" ? "Новые (ожидают)" : "Yangi (kutilmoqda)"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{openHeadcount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-700">
            {lang === "ru" ? "Принято рекрутером" : "Qabul qilingan"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{acceptedHeadcount}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-blue-700">
            {lang === "ru" ? "Закрыто / Занято" : "Yopilgan / Band"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-[#3b6ff5]">
            {closedOrFilledHeadcount}
          </p>
        </div>
      </div>

      {/* Search + Professional FilterPopover */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "ru"
                ? "Поиск по должности, филиалу..."
                : "Lavozim, filial yoki shahar bo'yicha qidirish..."
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs shadow-2xs focus:border-[#5865f2] focus:outline-none"
          />
        </div>

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(filters);
                setFilterOpen((o) => !o);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-[#5865f2]/40"
            >
              <Filter className="h-3.5 w-3.5 text-slate-600" />
              <span>{lang === "ru" ? "Фильтры" : "Filtrlar"}</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1e293b] px-1.5 text-[10px] font-extrabold text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {filters.branches.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 rounded-full bg-[#4f7df3] px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {b}
                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      branches: filters.branches.filter((x) => x !== b),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {filters.tracks.map((tr) => (
              <span
                key={tr}
                className="inline-flex items-center gap-1 rounded-full bg-[#4f7df3] px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {getTrackTitle(tr, lang)}
                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      tracks: filters.tracks.filter((x) => x !== tr),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {filterOpen && (
            <div className="absolute left-0 z-40 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-100 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
              <div className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 border-l border-t border-slate-100 bg-white" />
              <div className="space-y-4 p-5 text-xs">
                <div>
                  <p className="mb-2 font-bold text-slate-800">
                    {lang === "ru" ? "Филиалы" : "Filiallar"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                    {branches.map((b) => {
                      const sel = draft.branches.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, branches: toggleArr(draft.branches, b) })
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                            sel
                              ? "bg-[#4f7df3] text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {b}
                          {sel && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-bold text-slate-800">
                    {lang === "ru" ? "Направления" : "Yo'nalishlar"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                    {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => {
                      const sel = draft.tracks.includes(tr);
                      return (
                        <button
                          key={tr}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, tracks: toggleArr(draft.tracks, tr) })
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                            sel
                              ? "bg-[#4f7df3] text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {getTrackTitle(tr, lang)}
                          {sel && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-bold text-slate-800">
                    {lang === "ru" ? "Статус" : "Holat"}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: "open", label: lang === "ru" ? "Новая" : "Yangi" },
                      { id: "accepted", label: lang === "ru" ? "Принята" : "Qabul qilindi" },
                      { id: "closed", label: lang === "ru" ? "Закрыта" : "Yopiq" },
                    ].map((st) => {
                      const checked = draft.statuses.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              statuses: toggleArr(draft.statuses, st.id),
                            })
                          }
                          className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                              checked
                                ? "border-[#4f7df3] bg-[#4f7df3] text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          {st.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    const empty: VacFilterState = { branches: [], tracks: [], statuses: [] };
                    setDraft(empty);
                    setFilters(empty);
                    setFilterOpen(false);
                  }}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70"
                >
                  {lang === "ru" ? "Сбросить" : "Tozalash"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters(draft);
                    setFilterOpen(false);
                  }}
                  className="rounded-full bg-[#2b3a67] px-6 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1e294b]"
                >
                  {lang === "ru" ? "Применить" : "Saqlash"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cards or Table */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-12 text-center text-sm text-slate-500">
          {lang === "ru" ? "Вакансии не найдены." : "Vakansiyalar topilmadi."}
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v, idx) => {
            const theme = CARD_THEMES[idx % CARD_THEMES.length];
            const openedDate = new Date(v.approvedAt).toLocaleDateString("ru-RU");
            const appsCount = db.applications.filter((a) => a.vacancyId === v.id).length;
            const recruiter = db.users.find((u) => u.id === v.responsibleRecruiterId);

            return (
              <div
                key={v.id}
                className={`relative flex min-h-[225px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bg} p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border border-white/25 bg-white/5" />

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-bold shadow-xs ${theme.pill}`}
                    >
                      {getStatusLabel(v.status)} • {openedDate}
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

                <div className="relative z-10 mt-4 space-y-2 text-xs">
                  <p className="text-[11px] text-white/95">
                    {lang === "ru" ? "Штат:" : "Shtat:"} <b>{v.filledCount}/{v.headcount}</b> •{" "}
                    {lang === "ru" ? "Откликов:" : "Nomzodlar:"} <b>{appsCount}</b>
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.status === "open" ? (
                      <button
                        type="button"
                        disabled={acceptingId === v.id}
                        onClick={() => handleAcceptVacancy(v.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-extrabold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        {acceptingId === v.id
                          ? "..."
                          : lang === "ru"
                          ? "Принять"
                          : "Qabul qilish"}
                      </button>
                    ) : v.status === "accepted" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {lang === "ru" ? "Принята" : "Qabul qilindi"}
                        {recruiter ? ` (${recruiter.fullName.split(" ")[0]})` : ""}
                      </span>
                    ) : null}

                    {currentUser.role === "admin" && (v.status === "open" || v.status === "accepted") && (
                      <button
                        type="button"
                        disabled={acceptingId === v.id}
                        onClick={() => handleCloseVacancy(v.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-xs transition hover:bg-slate-900/80 disabled:opacity-50"
                      >
                        {lang === "ru" ? "Закрыть" : "Yopish"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pointer-events-none absolute -bottom-5 -right-5 flex h-28 w-28 items-center justify-center rounded-full border border-white/35 bg-white/20 backdrop-blur-[2px]">
                  <div className="-translate-x-1.5 -translate-y-1.5">
                    {getPositionIcon(v.position, v.track)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Должность" : "Lavozim"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Филиал" : "Filial"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Направление" : "Yo'nalish"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Открыта" : "Ochilgan"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Штат" : "Shtat"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Статус" : "Holat"}</th>
                <th className="pb-2.5 font-semibold">{lang === "ru" ? "Действие" : "Amal"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-3 font-bold text-slate-900">{v.position}</td>
                  <td className="py-3 text-slate-600">
                    {v.branch} ({v.city})
                  </td>
                  <td className="py-3 text-slate-600">{getTrackTitle(v.track, lang)}</td>
                  <td className="py-3 text-slate-500">
                    {new Date(v.approvedAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="py-3 font-semibold">
                    {v.filledCount} / {v.headcount}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        v.status === "accepted"
                          ? "bg-emerald-100 text-emerald-700"
                          : v.status === "open"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {getStatusLabel(v.status)}
                    </span>
                  </td>
                  <td className="py-3">
                    {v.status === "open" ? (
                      <button
                        type="button"
                        disabled={acceptingId === v.id}
                        onClick={() => handleAcceptVacancy(v.id)}
                        className="rounded-full bg-[#5865f2] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#4752c4]"
                      >
                        {lang === "ru" ? "Принять" : "Qabul qilish"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
