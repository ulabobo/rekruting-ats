"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  FileSpreadsheet,
  Filter,
  Kanban,
  Layers,
  LogOut,
  MapPin,
  Plus,
  Search,
  Settings,
  Star,
  Store,
  Table2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AtsDatabase, Language, TrackType, User } from "@/types/ats";
import { TRACK_CONFIGS, getStageLabel, getTrackTitle } from "@/lib/stages";
import { UI_TEXT } from "@/lib/i18n";
import LoginScreen from "@/components/LoginScreen";
import CandidateDrawer from "@/components/CandidateDrawer";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import VacanciesPanel from "@/components/VacanciesPanel";
import AllCandidatesPanel from "@/components/AllCandidatesPanel";
import AdminSettingsPanel from "@/components/AdminSettingsPanel";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import ParticleBackground from "@/components/ParticleBackground";
import FilterPopover, { FilterState } from "@/components/FilterPopover";
import {
  AddCandidateModal,
  CreateMassProjectModal,
  CreateVacancyModal,
} from "@/components/Modals";

type NavSection =
  | { kind: "track"; track: TrackType }
  | { kind: "vacancies" }
  | { kind: "all_candidates" }
  | { kind: "reserved" }
  | { kind: "blacklist" }
  | { kind: "analytics" }
  | { kind: "settings" };

export default function AtsDashboard({
  initialDb,
  initialUser,
}: {
  initialDb: AtsDatabase;
  initialUser: User | null;
}) {
  const [db, setDb] = useState<AtsDatabase>(initialDb);
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [lang, setLang] = useState<Language>("uz");

  const t = UI_TEXT[lang];

  const defaultTrack: TrackType =
    currentUser?.allowedTracks?.[0] || "dokon_xodimi";

  const [activeNav, setActiveNav] = useState<NavSection>({
    kind: "track",
    track: defaultTrack,
  });
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    branches: [],
    positions: [],
    sources: [],
    onlyDuplicates: false,
    onlySlaBreach: false,
  });

  // Modals & Drawers
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [showMassModal, setShowMassModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pushToasts, setPushToasts] = useState<
    { id: string; title: string; message: string; type: "info" | "warning" | "success" | "action"; time: string }[]
  >([]);
  const seenNotifIds = useRef<Set<string>>(new Set(initialDb.notifications.map((n) => n.id)));
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);

  const pushMobileToast = (
    type: "info" | "warning" | "success" | "action",
    title: string,
    message: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const time = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
    setPushToasts((prev) => [{ id, title, message, type, time }, ...prev].slice(0, 3));
    setTimeout(() => {
      setPushToasts((prev) => prev.filter((x) => x.id !== id));
    }, 5000);
  };

  const showBanner = (type: "ok" | "err", text: string) => {
    pushMobileToast(
      type === "ok" ? "success" : "warning",
      type === "ok" ? (lang === "ru" ? "Успешно" : "Muvaffaqiyatli") : lang === "ru" ? "Внимание" : "Diqqat",
      text
    );
  };

  // Avtomatik fon yangilanishi (har 60 soniyada) + yangi bildirishnomalar uchun mobil push toast
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(async () => {
      try {
        await fetch("/api/sheets/poll", { method: "POST" }).catch(() => {});
        await fetch("/api/cron/onboarding").catch(() => {});
        const res = await fetch("/api/ats", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.db) {
            const incomingNotifs = (data.db as AtsDatabase).notifications || [];
            for (const n of incomingNotifs) {
              if (!n.read && !seenNotifIds.current.has(n.id)) {
                seenNotifIds.current.add(n.id);
                pushMobileToast(n.type, n.title, n.message);
              }
            }
            setDb(data.db);
          }
        }
      } catch {
        // tarmoq xatosida jim o'tadi
      }
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [currentUser]);

  const activeTrack: TrackType =
    activeNav.kind === "track" ? activeNav.track : "dokon_xodimi";
  const trackConfig = TRACK_CONFIGS[activeTrack];

  const branchesForTrack = useMemo(() => {
    const set = new Set<string>();
    db.vacancies.filter((v) => v.track === activeTrack).forEach((v) => set.add(v.branch));
    return Array.from(set);
  }, [db.vacancies, activeTrack]);

  const positionsForTrack = useMemo(() => {
    const set = new Set<string>();
    db.vacancies.filter((v) => v.track === activeTrack).forEach((v) => set.add(v.position));
    return Array.from(set);
  }, [db.vacancies, activeTrack]);

  const trackApps = useMemo(() => {
    return db.applications.filter((app) => {
      if (app.track !== activeTrack) return false;
      const cand = db.candidates.find((c) => c.id === app.candidateId);
      const vac = db.vacancies.find((v) => v.id === app.vacancyId);
      if (!cand || !vac) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !cand.fullName.toLowerCase().includes(q) &&
          !cand.phone.toLowerCase().includes(q) &&
          !vac.position.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.branches.length > 0 && !filters.branches.includes(vac.branch)) return false;
      if (filters.positions.length > 0 && !filters.positions.includes(vac.position)) return false;
      if (filters.sources.length > 0 && !filters.sources.includes(cand.source)) return false;
      if (filters.onlyDuplicates && !app.isDuplicateWarning) return false;
      if (filters.onlySlaBreach) {
        const openDays = Math.floor(
          (Date.now() - new Date(vac.approvedAt).getTime()) / 86400000
        );
        if (openDays <= vac.slaDays) return false;
      }
      return true;
    });
  }, [db, activeTrack, searchQuery, filters]);

  if (!currentUser) {
    return (
      <LoginScreen
        lang={lang}
        onChangeLang={setLang}
        onLoginSuccess={async (user) => {
          setCurrentUser(user);
          setActiveNav({
            kind: "track",
            track: user.allowedTracks[0] || "dokon_xodimi",
          });
          const res = await fetch("/api/ats");
          const data = await res.json();
          if (data.db) setDb(data.db);
        }}
      />
    );
  }

  const unreadNotifs = db.notifications.filter((n) => !n.read).length;

  const handleDropToStage = async (targetStage: string) => {
    if (!draggedAppId) return;
    const appId = draggedAppId;
    setDraggedAppId(null);

    const res = await fetch("/api/ats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move_stage",
        applicationId: appId,
        targetStage,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        lang,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner("err", data.error);
    } else {
      setDb(data.db);
      showBanner("ok", getStageLabel(activeTrack, targetStage, lang));
    }
  };

  const selectedApp = db.applications.find((a) => a.id === selectedAppId) || null;

  const trackIcons: Record<TrackType, React.ReactNode> = {
    dokon_xodimi: <Store className="h-4 w-4" />,
    dokon_rahbari: <UserCheck className="h-4 w-4" />,
    ofis_xodimi: <Briefcase className="h-4 w-4" />,
    ommaviy_yollash: <Layers className="h-4 w-4" />,
  };

  const formatStageDuration = (iso: string) => {
    const diffHours = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
    if (diffHours < 24) return `${diffHours} ${t.hoursShort}`;
    return `${Math.floor(diffHours / 24)} ${t.daysShort}`;
  };

  return (
    <div
      className="relative flex h-screen overflow-hidden text-slate-900"
      style={{
        background:
          "radial-gradient(circle at 10% 90%, rgba(108,114,255,0.14) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(78,165,255,0.16) 0%, transparent 50%), #f1f5fb",
      }}
    >
      <ParticleBackground />
      <AnalyticsScripts settings={db.settings} />
      {/* Sidebar - Clean Frosted White matching Login Design */}
      <aside className="relative z-10 flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <img
            src="/logo.png?v=3"
            alt="Rekruting ATS"
            className="h-9 w-9 rounded-xl object-cover shadow-sm"
          />
          <div>
            <p className="text-base font-extrabold tracking-tight text-slate-900">{t.appName}</p>
            <p className="text-[10px] font-medium text-slate-400">{t.appSubtitle}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.directionsGroup}
            </p>
            <div className="space-y-1">
              {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => {
                if (
                  currentUser.role !== "admin" &&
                  !currentUser.allowedTracks.includes(tr)
                ) {
                  return null;
                }
                const isActive = activeNav.kind === "track" && activeNav.track === tr;
                const count = db.applications.filter(
                  (a) => a.track === tr && a.status !== "rejected"
                ).length;

                return (
                  <button
                    key={tr}
                    onClick={() => {
                      setActiveNav({ kind: "track", track: tr });
                      setFilters({
                        branches: [],
                        positions: [],
                        sources: [],
                        onlyDuplicates: false,
                        onlySlaBreach: false,
                      });
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#5865f2] text-white shadow-sm shadow-[#5865f2]/25"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {trackIcons[tr]}
                      <span className="truncate">{getTrackTitle(tr, lang)}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t.managementGroup}
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveNav({ kind: "vacancies" })}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeNav.kind === "vacancies"
                    ? "bg-[#5865f2] text-white shadow-sm shadow-[#5865f2]/25"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4" />
                  {t.vacanciesNav}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeNav.kind === "vacancies"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {db.vacancies
                    .filter(
                      (v) =>
                        !v.id.startsWith("vac-res-") &&
                        !v.id.startsWith("vac-city-") &&
                        (v.status === "open" || v.status === "accepted")
                    )
                    .reduce((s, v) => s + v.headcount, 0)}
                </span>
              </button>

              <button
                onClick={() => setActiveNav({ kind: "all_candidates" })}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeNav.kind === "all_candidates"
                    ? "bg-[#5865f2] text-white shadow-sm shadow-[#5865f2]/25"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Users className="h-4 w-4" />
                  {t.allCandidatesNav}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeNav.kind === "all_candidates"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {db.applications.length}
                </span>
              </button>

              <button
                onClick={() => setActiveNav({ kind: "reserved" })}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeNav.kind === "reserved"
                    ? "bg-[#5865f2] text-white shadow-sm shadow-[#5865f2]/25"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Bookmark className="h-4 w-4" />
                  {t.statusReserved}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeNav.kind === "reserved"
                      ? "bg-white/20 text-white"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {db.applications.filter((a) => a.status === "reserved").length}
                </span>
              </button>

              <button
                onClick={() => setActiveNav({ kind: "blacklist" })}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeNav.kind === "blacklist"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Ban className="h-4 w-4" />
                  {t.statusBlacklist}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeNav.kind === "blacklist"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {db.applications.filter((a) => a.status === "blacklist").length}
                </span>
              </button>

              <button
                onClick={() => setActiveNav({ kind: "analytics" })}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeNav.kind === "analytics"
                    ? "bg-[#5865f2] text-white shadow-sm shadow-[#5865f2]/25"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                {t.analyticsNav}
              </button>

              <button
                onClick={() => setActiveNav({ kind: "settings" })}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  activeNav.kind === "settings"
                    ? "bg-[#5865f2] text-white shadow-sm shadow-[#5865f2]/25"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <Settings className="h-4 w-4" />
                {t.adminSettingsNav}
              </button>
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">{currentUser.fullName}</p>
              <p className="truncate text-[10px] text-slate-500">{currentUser.position}</p>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                setCurrentUser(null);
              }}
              title={t.logout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-6 py-3 backdrop-blur-md">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* UZ / RU Switcher */}
            <div className="flex rounded-xl border border-slate-200 p-0.5 text-xs font-bold">
              <button
                onClick={() => setLang("uz")}
                className={`rounded-lg px-2.5 py-1 ${
                  lang === "uz" ? "bg-[#5865f2] text-white" : "text-slate-600"
                }`}
              >
                UZ
              </button>
              <button
                onClick={() => setLang("ru")}
                className={`rounded-lg px-2.5 py-1 ${
                  lang === "ru" ? "bg-[#5865f2] text-white" : "text-slate-600"
                }`}
              >
                RU
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowNotifications((s) => !s)}
                className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-3xl border border-white/70 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.2)] backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      {lang === "ru" ? "Уведомления" : "Bildirishnomalar"}
                    </span>
                    <button
                      onClick={async () => {
                        // Darhol optimistik yangilash (qotib qolmasligi uchun)
                        setDb((prev) => ({
                          ...prev,
                          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
                        }));
                        setShowNotifications(false);
                        const res = await fetch("/api/ats", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "mark_notifications_read" }),
                        });
                        const data = await res.json();
                        if (data.db) setDb(data.db);
                      }}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#3b6ff5] hover:bg-blue-100"
                    >
                      {lang === "ru" ? "Прочитать все" : "O'qildi"}
                    </button>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {db.notifications.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">—</p>
                    ) : (
                      db.notifications.slice(0, 3).map((n) => {
                        const iconBg =
                          n.type === "warning"
                            ? "bg-rose-500"
                            : n.type === "success"
                            ? "bg-emerald-500"
                            : "bg-[#3b6ff5]";
                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              setDb((prev) => ({
                                ...prev,
                                notifications: prev.notifications.map((x) =>
                                  x.id === n.id ? { ...x, read: true } : x
                                ),
                              }));
                              if (n.relatedApplicationId) {
                                setSelectedAppId(n.relatedApplicationId);
                                setShowNotifications(false);
                              }
                            }}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-xs transition ${
                              n.read
                                ? "border-slate-100 bg-slate-50/70 opacity-75"
                                : "border-white bg-gradient-to-r from-white to-blue-50/60 shadow-sm"
                            }`}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${iconBg}`}
                            >
                              <Bell className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="truncate font-bold text-slate-900">{n.title}</p>
                                <span className="shrink-0 text-[10px] text-slate-400">
                                  {new Date(n.createdAt).toLocaleTimeString("uz-UZ", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                                {n.message}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile App Style Top-Right Slide-In Notifications (5s auto-dismiss, Rasmdagidek) */}
        {pushToasts.length > 0 && (
          <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2.5">
            {pushToasts.map((toast) => {
              const iconBg =
                toast.type === "warning"
                  ? "bg-rose-500"
                  : toast.type === "success"
                  ? "bg-emerald-500"
                  : "bg-[#3b6ff5]";
              return (
                <div
                  key={toast.id}
                  className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/80 bg-gradient-to-r from-white/95 via-white/90 to-sky-50/90 p-3.5 shadow-[0_14px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl animate-in slide-in-from-right duration-300"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${iconBg}`}
                  >
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-extrabold text-slate-900">
                        {toast.title}
                      </p>
                      <span className="shrink-0 text-[10px] font-medium text-slate-400">
                        {toast.time}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                      {toast.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <main
          className={`flex-1 p-6 ${
            activeNav.kind === "track" && viewMode === "kanban"
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
          {activeNav.kind === "vacancies" && (
            <VacanciesPanel
              db={db}
              currentUser={currentUser}
              lang={lang}
              onOpenCreateVacancy={() => setShowVacancyModal(true)}
              onUpdateDb={setDb}
            />
          )}

          {activeNav.kind === "all_candidates" && (
            <AllCandidatesPanel
              db={db}
              lang={lang}
              onSelectApp={(id) => setSelectedAppId(id)}
            />
          )}

          {activeNav.kind === "reserved" && (
            <AllCandidatesPanel
              db={db}
              lang={lang}
              lockedFilter="reserved"
              onSelectApp={(id) => setSelectedAppId(id)}
            />
          )}

          {activeNav.kind === "blacklist" && (
            <AllCandidatesPanel
              db={db}
              lang={lang}
              lockedFilter="blacklist"
              onSelectApp={(id) => setSelectedAppId(id)}
            />
          )}

          {activeNav.kind === "analytics" && <AnalyticsPanel db={db} />}

          {activeNav.kind === "settings" && (
            <AdminSettingsPanel
              db={db}
              currentUser={currentUser}
              lang={lang}
              onUpdateDb={setDb}
            />
          )}

          {activeNav.kind === "track" && (
            <div
              className={
                viewMode === "kanban"
                  ? "flex min-h-0 flex-1 flex-col gap-4"
                  : "space-y-5"
              }
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-extrabold text-slate-900">
                      {getTrackTitle(activeTrack, lang)}
                    </h1>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {lang === "ru" ? trackConfig.slaLabelRu : trackConfig.slaLabelUz}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lang === "ru" ? trackConfig.subtitleRu : trackConfig.subtitleUz}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
                    <button
                      onClick={() => setViewMode("kanban")}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        viewMode === "kanban" ? "bg-blue-600 text-white" : "text-slate-600"
                      }`}
                    >
                      <Kanban className="h-3.5 w-3.5" /> {t.boardView}
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        viewMode === "table" ? "bg-blue-600 text-white" : "text-slate-600"
                      }`}
                    >
                      <Table2 className="h-3.5 w-3.5" /> {t.tableView}
                    </button>
                  </div>

                  {activeTrack === "ommaviy_yollash" && (
                    <button
                      onClick={() => setShowMassModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Building2 className="h-3.5 w-3.5" /> {t.newStore}
                    </button>
                  )}

                  <button
                    onClick={() => setShowVacancyModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t.addVacancy}
                  </button>

                  <button
                    onClick={() => setShowCandidateModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> {t.addCandidate}
                  </button>
                </div>
              </div>

              {activeTrack === "ommaviy_yollash" && db.massProjects.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {db.massProjects.map((proj) => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil((new Date(proj.openingDate).getTime() - Date.now()) / 86400000)
                    );
                    return (
                      <div
                        key={proj.id}
                        className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-xs"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{proj.storeName}</h3>
                            <p className="text-[11px] text-slate-500">{proj.address}</p>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                            <Calendar className="h-3.5 w-3.5" />
                            {daysLeft} {t.daysShort}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {proj.quotas.map((q) => {
                            const pct = Math.min(
                              100,
                              Math.round((q.hiredCount / q.requiredCount) * 100)
                            );
                            return (
                              <div key={q.position} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                                <div className="mb-1 flex justify-between font-semibold">
                                  <span className="truncate text-slate-700">{q.position}</span>
                                  <span className="text-indigo-700">
                                    {q.hiredCount}/{q.requiredCount}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-indigo-600"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Professional Filter Popover (Rasmdagidek) */}
              <div className="shrink-0 py-1">
                <FilterPopover
                  lang={lang}
                  availableBranches={branchesForTrack}
                  availablePositions={positionsForTrack}
                  value={filters}
                  onChange={setFilters}
                />
              </div>

              {/* Clean Professional Kanban Cards */}
              {viewMode === "kanban" ? (
                <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
                  {trackConfig.stages.map((stage) => {
                    const stageApps = trackApps.filter(
                      (a) =>
                        a.currentStage === stage.id &&
                        a.status !== "rejected" &&
                        a.status !== "blacklist" &&
                        a.status !== "reserved"
                    );
                    return (
                      <div
                        key={stage.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropToStage(stage.id)}
                        className="flex h-full w-72 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-xs"
                      >
                        <div
                          className="mb-3 flex shrink-0 items-center justify-between border-b-2 pb-2.5"
                          style={{ borderColor: stage.color }}
                        >
                          <span className="text-xs font-bold text-slate-900">
                            {lang === "ru" ? stage.labelRu : stage.labelUz}
                          </span>
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                            {stageApps.length}
                          </span>
                        </div>

                        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                          {stageApps.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">
                              {t.emptyColumn}
                            </div>
                          ) : (
                            stageApps.map((app) => {
                              const cand = db.candidates.find((c) => c.id === app.candidateId)!;
                              const vac = db.vacancies.find((v) => v.id === app.vacancyId)!;
                              const ratingPillClass =
                                app.matchScore >= 75
                                  ? "bg-emerald-500 text-white"
                                  : app.matchScore >= 50
                                  ? "bg-amber-400 text-white"
                                  : "bg-rose-500 text-white";
                              const starRating = (app.matchScore / 20).toFixed(1);

                              const isAutopilot = ["test_kuni", "offer", "hujjat_lms", "ishga_qabul"].includes(
                                app.currentStage
                              );

                              const attendance = cand.questionnaireData?.interviewAttendance;
                              const onbFlow = db.onboardingFlows?.find(
                                (f) => f.applicationId === app.id
                              );
                              const formattedTestDate = (() => {
                                const raw = onbFlow?.testDate;
                                if (!raw) return "";
                                const parts = raw.split("-");
                                return parts.length === 3
                                  ? `${parts[2]}.${parts[1]}.${parts[0]}`
                                  : raw;
                              })();
                              const cardTintClass =
                                attendance === "arrived"
                                  ? "border-emerald-300 bg-emerald-50/85 hover:border-emerald-400"
                                  : attendance === "no_show"
                                  ? "border-rose-300 bg-rose-50/90 hover:border-rose-400"
                                  : "border-slate-100 bg-white hover:border-[#5865f2]/40";

                              return (
                                <div
                                  key={app.id}
                                  draggable={!isAutopilot}
                                  onDragStart={() => {
                                    if (!isAutopilot) setDraggedAppId(app.id);
                                  }}
                                  onClick={() => setSelectedAppId(app.id)}
                                  className={`cursor-pointer rounded-2xl border p-4 shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md ${cardTintClass}`}
                                >
                                  {attendance && (
                                    <div className="mb-2 flex items-center justify-end">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                          attendance === "arrived"
                                            ? "bg-emerald-600 text-white"
                                            : "bg-rose-600 text-white"
                                        }`}
                                      >
                                        {attendance === "arrived"
                                          ? lang === "ru"
                                            ? "✓ Пришёл на интервью"
                                            : "✓ Suhbatga keldi"
                                          : lang === "ru"
                                          ? "✕ Не пришёл"
                                          : "✕ Suhbatga kelmadi"}
                                      </span>
                                    </div>
                                  )}
                                  {/* Avatar + Name + Position (2-rasm uslubida) */}
                                  <div className="flex items-center gap-3">
                                    {cand.avatarUrl ? (
                                      <img
                                        src={cand.avatarUrl}
                                        alt={cand.fullName}
                                        className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover shadow-xs"
                                      />
                                    ) : (
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5865f2] to-[#3b82f6] text-xs font-extrabold text-white shadow-xs">
                                        {cand.fullName
                                          .split(" ")
                                          .slice(0, 2)
                                          .map((n) => n[0])
                                          .join("")}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-slate-900">
                                        {cand.fullName}
                                      </p>
                                      <p className="truncate text-xs text-slate-400">
                                        {vac.position}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Rating Pill + Location */}
                                  <div className="mt-3 flex items-center gap-2 text-xs">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ratingPillClass}`}
                                    >
                                      <Star className="h-3 w-3 fill-white text-white" />
                                      {starRating}
                                    </span>
                                    <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-slate-600">
                                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                      <span className="truncate">
                                        {vac.branch}
                                      </span>
                                    </span>
                                  </div>

                                  {/* Experience & Source */}
                                  <div className="mt-2.5 space-y-0.5 text-[11px] text-slate-500">
                                    <p>
                                      {cand.experienceYears || "Tajriba ko'rsatilmagan"} •{" "}
                                      {cand.source}
                                    </p>
                                  </div>

                                  {/* Tags */}
                                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                                    {formattedTestDate ? (
                                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
                                        📅 {lang === "ru" ? "Тест" : "Sinov"}: {formattedTestDate}
                                      </span>
                                    ) : app.currentStage === "test_kuni" ? (
                                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                        ⏳ {lang === "ru" ? "Ожидает выбора даты" : "Sinov kuni kutilmoqda"}
                                      </span>
                                    ) : null}
                                    {cand.tags.slice(0, 2).map((tg) => (
                                      <span
                                        key={tg}
                                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600"
                                      >
                                        {tg}
                                      </span>
                                    ))}
                                    {app.isDuplicateWarning && (
                                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                        {t.duplicateBadge}
                                      </span>
                                    )}
                                  </div>

                                  {/* Bottom Row: Time + Blue Pill Button */}
                                  <div className="mt-3.5 flex items-center justify-between gap-2 pt-1">
                                    <div className="text-[11px] font-semibold text-slate-600">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-slate-400" />
                                        {formatStageDuration(app.stageEnteredAt)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="rounded-full bg-[#3b6ff5] px-4 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-[#2557d6]"
                                    >
                                      {lang === "ru" ? "Открыть" : "Ko'rish"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2.5 font-semibold">{lang === "ru" ? "ФИО" : "F.I.O"}</th>
                        <th className="pb-2.5 font-semibold">{t.phoneLabel}</th>
                        <th className="pb-2.5 font-semibold">{t.vacancyLabel}</th>
                        <th className="pb-2.5 font-semibold">{lang === "ru" ? "Этап" : "Bosqich"}</th>
                        <th className="pb-2.5 font-semibold">{t.matchLabel}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trackApps.map((app) => {
                        const cand = db.candidates.find((c) => c.id === app.candidateId)!;
                        const vac = db.vacancies.find((v) => v.id === app.vacancyId)!;
                        return (
                          <tr
                            key={app.id}
                            onClick={() => setSelectedAppId(app.id)}
                            className="cursor-pointer hover:bg-blue-50/40"
                          >
                            <td className="py-3 font-bold text-slate-900">{cand.fullName}</td>
                            <td className="py-3 text-slate-600">{cand.phone}</td>
                            <td className="py-3 text-slate-700">
                              {vac.position} ({vac.branch})
                            </td>
                            <td className="py-3">
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                {getStageLabel(app.track, app.currentStage, lang)}
                              </span>
                            </td>
                            <td className="py-3 font-bold">{app.matchScore}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {selectedApp && (
        <CandidateDrawer
          application={selectedApp}
          db={db}
          currentUser={currentUser}
          lang={lang}
          onClose={() => setSelectedAppId(null)}
          onUpdateDb={setDb}
        />
      )}

      {showVacancyModal && (
        <CreateVacancyModal
          defaultTrack={activeTrack}
          currentUser={currentUser}
          lang={lang}
          onClose={() => setShowVacancyModal(false)}
          onSuccess={(newDb) => setDb(newDb)}
        />
      )}

      {showMassModal && (
        <CreateMassProjectModal
          currentUser={currentUser}
          lang={lang}
          onClose={() => setShowMassModal(false)}
          onSuccess={(newDb) => setDb(newDb)}
        />
      )}

      {showCandidateModal && (
        <AddCandidateModal
          db={db}
          defaultTrack={activeTrack}
          lang={lang}
          onClose={() => setShowCandidateModal(false)}
          onSuccess={(newDb, isDup) => {
            setDb(newDb);
            if (isDup) showBanner("err", t.duplicateBadge);
          }}
        />
      )}
    </div>
  );
}
