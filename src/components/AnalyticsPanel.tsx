"use client";

import React, { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  Building2,
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Application, AtsDatabase, TrackType } from "@/types/ats";
import { TRACK_CONFIGS } from "@/lib/stages";

interface AnalyticsPanelProps {
  db: AtsDatabase;
}

type PeriodKey = "all" | "today" | "week" | "month" | "quarter" | "year" | "custom";

const STAGE_RANK: Record<string, number> = {
  otklik: 1,
  call_screen: 2,
  rahbar_suhbati: 3,
  test_kuni: 4,
  amaliy_topshiriq: 4,
  offer: 5,
  hujjat_lms: 6,
  ishga_qabul: 7,
};

function getPeriodBounds(
  period: PeriodKey,
  customFrom: string,
  customTo: string
): { start: number; end: number } {
  const now = new Date();
  const end = now.getTime() + 86400000;
  if (period === "all") return { start: 0, end: Infinity };
  if (period === "today") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { start: s, end: s + 86400000 };
  }
  if (period === "week") {
    return { start: now.getTime() - 7 * 86400000, end };
  }
  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end };
  }
  if (period === "quarter") {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), qStartMonth, 1).getTime(), end };
  }
  if (period === "year") {
    return { start: new Date(now.getFullYear(), 0, 1).getTime(), end };
  }
  const s = customFrom ? new Date(customFrom).getTime() : 0;
  const e = customTo ? new Date(customTo).getTime() + 86400000 : Infinity;
  return { start: s, end: e };
}

function calcAvgDays(pairs: { start?: string; end?: string }[]): { label: string; value: number } {
  const valid = pairs.filter((p) => p.start && p.end);
  if (valid.length === 0) return { label: "—", value: 0 };
  const total = valid.reduce((sum, p) => {
    const diff = (new Date(p.end!).getTime() - new Date(p.start!).getTime()) / 86400000;
    return sum + Math.max(0.1, diff);
  }, 0);
  const avg = total / valid.length;
  return { label: `${avg.toFixed(1)} kun`, value: Number(avg.toFixed(1)) };
}

export default function AnalyticsPanel({ db }: AnalyticsPanelProps) {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const branchesList = useMemo(
    () => Array.from(new Set(db.vacancies.map((v) => v.branch).filter(Boolean))),
    [db.vacancies]
  );

  const bounds = useMemo(
    () => getPeriodBounds(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const filteredApps = useMemo(() => {
    return db.applications.filter((a) => {
      const ts = new Date(a.appliedAt).getTime();
      if (ts < bounds.start || ts > bounds.end) return false;
      if (selectedRecruiterId !== "all" && a.assignedRecruiterId !== selectedRecruiterId)
        return false;
      if (selectedBranch !== "all") {
        const vac = db.vacancies.find((v) => v.id === a.vacancyId);
        if (!vac || vac.branch !== selectedBranch) return false;
      }
      return true;
    });
  }, [db.applications, db.vacancies, bounds, selectedRecruiterId, selectedBranch]);

  const filteredVacs = useMemo(() => {
    return db.vacancies.filter((v) => {
      const ts = new Date(v.approvedAt).getTime();
      if (period !== "all" && (ts < bounds.start || ts > bounds.end)) return false;
      if (selectedRecruiterId !== "all" && v.responsibleRecruiterId !== selectedRecruiterId)
        return false;
      if (selectedBranch !== "all" && v.branch !== selectedBranch) return false;
      return true;
    });
  }, [db.vacancies, bounds, period, selectedRecruiterId, selectedBranch]);

  const hasReachedStage = (a: Application, minRank: number) => {
    if (a.status === "hired") return true;
    return (STAGE_RANK[a.currentStage] || 1) >= minRank;
  };

  // Core KPIs
  const totalApps = filteredApps.length;
  const hiredApps = filteredApps.filter((a) => a.status === "hired");
  const totalHeadcount = filteredVacs.reduce((s, v) => s + v.headcount, 0);
  const filledHeadcount = filteredVacs.reduce(
    (s, v) => s + (v.status === "closed" ? v.headcount : v.filledCount),
    0
  );
  const fillRate = totalHeadcount > 0 ? Math.round((filledHeadcount / totalHeadcount) * 100) : 0;

  const timeToHire = calcAvgDays(
    hiredApps.map((a) => ({ start: a.appliedAt, end: a.lmsTransferredAt }))
  );
  const timeToFill = calcAvgDays(
    hiredApps.map((a) => {
      const vac = db.vacancies.find((v) => v.id === a.vacancyId);
      return { start: vac?.approvedAt || a.appliedAt, end: a.lmsTransferredAt };
    })
  );

  const reachedOffer = filteredApps.filter(
    (a) => hasReachedStage(a, 5) || a.status === "offered"
  ).length;
  const offerAcceptRate =
    reachedOffer > 0 ? Math.round((hiredApps.length / reachedOffer) * 100) : 0;

  const reachedTestDay = filteredApps.filter((a) => hasReachedStage(a, 4)).length;
  const testDayPassRate =
    reachedTestDay > 0 ? Math.round((reachedOffer / reachedTestDay) * 100) : 0;

  // Funnel Steps
  const funnelSteps = [
    { label: "Qiziqish bildirganlar", count: totalApps },
    { label: "Telefon suhbati", count: filteredApps.filter((a) => hasReachedStage(a, 2)).length },
    { label: "Rahbar bilan suhbat", count: filteredApps.filter((a) => hasReachedStage(a, 3)).length },
    { label: "1 kunlik sinov kuni", count: reachedTestDay },
    { label: "Ish taklifi (Offer)", count: reachedOffer },
    { label: "Hujjatlar yuborildi", count: filteredApps.filter((a) => hasReachedStage(a, 6)).length },
    { label: "Ishga qabul qilindi", count: hiredApps.length },
  ];

  // Rejection Reasons Breakdown
  const rejectionReasons = useMemo(() => {
    const map = new Map<string, number>();
    filteredApps
      .filter((a) => a.status === "rejected" || a.status === "blacklist")
      .forEach((a) => {
        const key = (a.rejectionReason || "Sabab ko'rsatilmagan").trim();
        map.set(key, (map.get(key) || 0) + 1);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredApps]);

  // Sourcing Quality Matrix (volume + hired conversion per source)
  const sourceStats = useMemo(() => {
    const map = new Map<string, { total: number; hired: number; active: number }>();
    filteredApps.forEach((a) => {
      const c = db.candidates.find((x) => x.id === a.candidateId);
      const src = c?.source || "Telegram bot";
      const curr = map.get(src) || { total: 0, hired: 0, active: 0 };
      curr.total += 1;
      if (a.status === "hired") curr.hired += 1;
      if (a.status === "active" || a.status === "offered") curr.active += 1;
      map.set(src, curr);
    });
    return Array.from(map.entries())
      .map(([source, st]) => ({
        source,
        ...st,
        convPct: st.total > 0 ? Math.round((st.hired / st.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredApps, db.candidates]);

  // Branch Demand & Fill Matrix
  const branchStats = useMemo(() => {
    const map = new Map<
      string,
      { headcount: number; filled: number; apps: number; hired: number; maxOpenDays: number }
    >();
    filteredVacs.forEach((v) => {
      const curr = map.get(v.branch) || {
        headcount: 0,
        filled: 0,
        apps: 0,
        hired: 0,
        maxOpenDays: 0,
      };
      curr.headcount += v.headcount;
      curr.filled += v.status === "closed" ? v.headcount : v.filledCount;
      if (v.status !== "closed") {
        const days = Math.max(0, Math.floor((Date.now() - new Date(v.approvedAt).getTime()) / 86400000));
        curr.maxOpenDays = Math.max(curr.maxOpenDays, days);
      }
      map.set(v.branch, curr);
    });
    filteredApps.forEach((a) => {
      const v = db.vacancies.find((x) => x.id === a.vacancyId);
      if (!v) return;
      const curr = map.get(v.branch) || {
        headcount: 0,
        filled: 0,
        apps: 0,
        hired: 0,
        maxOpenDays: 0,
      };
      curr.apps += 1;
      if (a.status === "hired") curr.hired += 1;
      map.set(v.branch, curr);
    });
    return Array.from(map.entries()).map(([branch, st]) => ({
      branch,
      ...st,
      fillPct: st.headcount > 0 ? Math.round((st.filled / st.headcount) * 100) : 0,
    }));
  }, [filteredVacs, filteredApps, db.vacancies]);

  // Recruiter KPIs
  const recruiterRows = useMemo(() => {
    return db.users.map((u) => {
      const uApps = filteredApps.filter((a) => a.assignedRecruiterId === u.id);
      const uHired = uApps.filter((a) => a.status === "hired");
      const uVacs = filteredVacs.filter((v) => v.responsibleRecruiterId === u.id).length;
      const slaOk = uHired.filter((a) => {
        const v = db.vacancies.find((x) => x.id === a.vacancyId);
        if (!v || !a.lmsTransferredAt) return true;
        const days = (new Date(a.lmsTransferredAt).getTime() - new Date(a.appliedAt).getTime()) / 86400000;
        return days <= (v.slaDays || 10);
      }).length;
      const ttf = calcAvgDays(
        uHired.map((a) => {
          const v = db.vacancies.find((x) => x.id === a.vacancyId);
          return { start: v?.approvedAt || a.appliedAt, end: a.lmsTransferredAt };
        })
      );
      return {
        id: u.id,
        fullName: u.fullName,
        vacs: uVacs,
        total: uApps.length,
        calls: uApps.filter((a) => hasReachedStage(a, 2)).length,
        managers: uApps.filter((a) => hasReachedStage(a, 3)).length,
        testDays: uApps.filter((a) => hasReachedStage(a, 4)).length,
        offers: uApps.filter((a) => hasReachedStage(a, 5) || a.status === "offered").length,
        docs: uApps.filter((a) => hasReachedStage(a, 6)).length,
        hired: uHired.length,
        ttf: ttf.label,
        slaPct: uHired.length > 0 ? `${Math.round((slaOk / uHired.length) * 100)}%` : "—",
      };
    });
  }, [db.users, db.vacancies, filteredApps, filteredVacs]);

  // 7-day calendar
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
    const closedCount = db.applications.filter(
      (a) => a.status === "hired" && sameDay(a.lmsTransferredAt)
    ).length;
    const appsInDay = db.applications.filter((a) => sameDay(a.appliedAt)).length;
    return {
      date: d.getDate(),
      dayName: dayNames[d.getDay()],
      isToday: i === 3,
      openedCount,
      closedCount,
      appsInDay,
    };
  });

  // Excel Export (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Metrika", "Qiymat"],
        ["Davr", period],
        ["Filial filtri", selectedBranch],
        ["Jami shtat o'rinlari", totalHeadcount],
        ["Yopilgan o'rinlar", filledHeadcount],
        ["Fill Rate (%)", `${fillRate}%`],
        ["Jami arizalar", totalApps],
        ["Ishga qabul qilindi", hiredApps.length],
        ["Time to Fill (o'rtacha)", timeToFill.label],
        ["Time to Hire (o'rtacha)", timeToHire.label],
        ["Offer Acceptance (%)", `${offerAcceptRate}%`],
        ["Sinov kuni o'tish (%)", `${testDayPassRate}%`],
      ]),
      "KPI_Umumiy"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Bosqich", "Soni", "Umumiydan %"],
        ...funnelSteps.map((s) => [
          s.label,
          s.count,
          totalApps > 0 ? `${Math.round((s.count / totalApps) * 100)}%` : "0%",
        ]),
      ]),
      "Voronka"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          "Rekruter",
          "Vakansiyalar",
          "Qiziqish",
          "Qo'ng'iroq",
          "Rahbar suhbati",
          "Sinov kuni",
          "Ish taklifi",
          "Hujjatlar",
          "Ishga qabul qilindi",
          "Time to Fill",
          "SLA %",
        ],
        ...recruiterRows.map((r) => [
          r.fullName,
          r.vacs,
          r.total,
          r.calls,
          r.managers,
          r.testDays,
          r.offers,
          r.docs,
          r.hired,
          r.ttf,
          r.slaPct,
        ]),
      ]),
      "Rekruterlar"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Filial", "Shtat", "Band/Yopilgan", "Fill Rate %", "Nomzodlar", "Qabul qilindi", "Max ochiq kun"],
        ...branchStats.map((b) => [
          b.branch,
          b.headcount,
          b.filled,
          `${b.fillPct}%`,
          b.apps,
          b.hired,
          b.maxOpenDays,
        ]),
      ]),
      "Filiallar"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Manba", "Jami nomzod", "Faol", "Ishga qabul qilindi", "Konversiya %"],
        ...sourceStats.map((s) => [s.source, s.total, s.active, s.hired, `${s.convPct}%`]),
      ]),
      "Manbalar"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["F.I.O", "Telefon", "Filial", "Lavozim", "Manba", "Bosqich", "Holat", "Ariza sanasi"],
        ...filteredApps.map((a) => {
          const c = db.candidates.find((x) => x.id === a.candidateId);
          const v = db.vacancies.find((x) => x.id === a.vacancyId);
          return [
            c?.fullName || "—",
            c?.phone || "—",
            v?.branch || "—",
            v?.position || "—",
            c?.source || "—",
            a.currentStage,
            a.status,
            a.appliedAt.slice(0, 10),
          ];
        }),
      ]),
      "Nomzodlar"
    );

    XLSX.writeFile(wb, `Rekruting_Analitika_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // PDF Export (.pdf)
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Rekruting ATS — Executive Analytics Report", 14, 16);
    doc.setFontSize(9);
    doc.text(
      `Sana: ${new Date().toLocaleDateString("ru-RU")}  |  Davr: ${period}  |  Filial: ${selectedBranch}`,
      14,
      23
    );

    autoTable(doc, {
      startY: 28,
      head: [["KPI Ko'rsatkich", "Qiymat", "Izoh"]],
      body: [
        ["Shtat to'lishi (Fill Rate)", `${fillRate}%`, `${filledHeadcount} / ${totalHeadcount}`],
        ["Time to Fill (o'rtacha)", timeToFill.label, "Vakansiya ochilganidan yopilgunigacha"],
        ["Time to Hire (o'rtacha)", timeToHire.label, "Nomzod arizasidan qabulgacha"],
        ["Offer Acceptance Rate", `${offerAcceptRate}%`, `${hiredApps.length} / ${reachedOffer}`],
        ["Sinov kuni o'tish %", `${testDayPassRate}%`, `${reachedOffer} / ${reachedTestDay}`],
      ],
    });

    const yAfterKpi = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: yAfterKpi,
      head: [["Rekruter", "Arizalar", "Qo'ng'iroq", "Rahbar", "Sinov", "Offer", "Hujjat", "Qabul", "Time to Fill"]],
      body: recruiterRows.map((r) => [
        r.fullName,
        r.total,
        r.calls,
        r.managers,
        r.testDays,
        r.offers,
        r.docs,
        r.hired,
        r.ttf,
      ]),
    });

    const yAfterRec = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: yAfterRec,
      head: [["Filial", "Shtat", "Yopilgan", "Fill %", "Nomzodlar", "Qabul qilindi"]],
      body: branchStats.map((b) => [
        b.branch,
        b.headcount,
        b.filled,
        `${b.fillPct}%`,
        b.apps,
        b.hired,
      ]),
    });

    doc.save(`Rekruting_Hisobot_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header + Export Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Executive BI Analitika va KPI
          </h2>
          <p className="text-xs text-slate-500">
            Kunlik, haftalik, oylik, choraklik va yillik kesimda rekruting samaradorligi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-2xs transition hover:bg-emerald-100"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100"
          >
            <FileText className="h-4 w-4" />
            PDF hisobot
          </button>
        </div>
      </div>

      {/* Power BI Filter Bar: Period + Branch + Recruiter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="mr-1 h-4 w-4 text-slate-400" />
          {(
            [
              ["all", "Barchasi"],
              ["today", "Bugun"],
              ["week", "Hafta"],
              ["month", "Oy"],
              ["quarter", "Chorak"],
              ["year", "Yil"],
              ["custom", "Oraliq"],
            ] as [PeriodKey, string][]
          ).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                period === k
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {lbl}
            </button>
          ))}
          {period === "custom" && (
            <div className="ml-2 flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1"
              />
              <span>—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            <option value="all">Barcha filiallar</option>
            {branchesList.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setSelectedRecruiterId("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                selectedRecruiterId === "all"
                  ? "bg-[#5865f2] text-white"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Umumiy holat
            </button>
            {db.users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedRecruiterId(u.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedRecruiterId === u.id
                    ? "bg-[#5865f2] text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {u.fullName.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <Target className="h-3.5 w-3.5 text-[#5865f2]" /> Shtat to&apos;lishi
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{fillRate}%</p>
          <p className="text-[10px] text-slate-400">
            {filledHeadcount} / {totalHeadcount} o&apos;rin
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-xs">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
            <Clock className="h-3.5 w-3.5" /> Time to Fill
          </p>
          <p className="mt-1 text-2xl font-extrabold text-indigo-700">{timeToFill.label}</p>
          <p className="text-[10px] text-indigo-500">Vakansiya → Qabul</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-blue-700">
            <Clock className="h-3.5 w-3.5" /> Time to Hire
          </p>
          <p className="mt-1 text-2xl font-extrabold text-blue-700">{timeToHire.label}</p>
          <p className="text-[10px] text-blue-500">Ariza → Qabul</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <Award className="h-3.5 w-3.5" /> Ishga qabul
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{hiredApps.length}</p>
          <p className="text-[10px] text-emerald-600">Jami {totalApps} arizadan</p>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-teal-700">Offer Acceptance</p>
          <p className="mt-1 text-2xl font-extrabold text-teal-700">{offerAcceptRate}%</p>
          <p className="text-[10px] text-teal-600">
            {hiredApps.length} / {reachedOffer} taklifdan
          </p>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-violet-700">Sinov kuni o&apos;tish</p>
          <p className="mt-1 text-2xl font-extrabold text-violet-700">{testDayPassRate}%</p>
          <p className="text-[10px] text-violet-600">
            {reachedOffer} / {reachedTestDay} sinovdan
          </p>
        </div>
      </div>

      {/* 🤖 Telegram Bot Voronkasi (Chiqib ketish nuqtalari) */}
      {(() => {
        const bf = (db.botFunnel || []).filter((x) => {
          const ts = new Date(x.updatedAt).getTime();
          return period === "all" || (ts >= bounds.start && ts <= bounds.end);
        });
        const totalStarted = bf.length;
        const botSteps = [
          { label: "/start bosdi", minRank: 1 },
          { label: "Bo'sh ish o'rinlari", minRank: 2 },
          { label: "Hudud tanladi", minRank: 3 },
          { label: "Filial tanladi", minRank: 4 },
          { label: "Smena / Savollar", minRank: 6 },
          { label: "Telefon raqam", minRank: 8 },
          { label: "Foto yukladi", minRank: 10 },
          { label: "Manba / Tasdiqlash", minRank: 11 },
          { label: "Anketani yubordi", minRank: 13 },
        ];
        const abandonedCount = bf.filter((x) => x.status === "in_progress" && x.furthestRank < 13).length;
        const remindedCount = bf.filter((x) => Boolean(x.remindedAt)).length;
        return (
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  🤖 Telegram Bot Voronkasi (Chiqib ketish nuqtalari)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Botga kirganlardan nechtasi qaysi qadamgacha yetib kelgani (yengil 1-qator/user tahlil)
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                  Jami kirgan: {totalStarted}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                  Yarim yo&apos;lda: {abandonedCount}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                  Eslatma yuborildi: {remindedCount}
                </span>
              </div>
            </div>
            {totalStarted === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Bot voronkasi ma&apos;lumotlari yangi kiruvchilardan boshlab avtomatik yig&apos;iladi.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
                {botSteps.map((st, i) => {
                  const cnt = bf.filter((x) => x.furthestRank >= st.minRank).length;
                  const pct = totalStarted > 0 ? Math.round((cnt / totalStarted) * 100) : 0;
                  return (
                    <div
                      key={st.label}
                      className={`rounded-2xl border p-3 text-center ${
                        i === botSteps.length - 1
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-slate-100 bg-slate-50/70"
                      }`}
                    >
                      <p className="text-[10px] font-semibold text-slate-500">{st.label}</p>
                      <p className="mt-1 text-lg font-extrabold text-slate-900">{cnt}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          i === botSteps.length - 1
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 3D Trapezoid Funnel + Rejection Reasons */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50/70 to-white p-6 shadow-xs lg:col-span-7">
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
                  const pct = totalApps > 0 ? Math.round((step.count / totalApps) * 100) : 0;
                  const prevCount = idx > 0 ? funnelSteps[idx - 1].count : step.count;
                  const stepConv =
                    idx > 0 && prevCount > 0 ? Math.round((step.count / prevCount) * 100) : 100;
                  const widthPct = widths[idx] ?? 44;

                  return (
                    <div key={step.label} className="flex items-center gap-3">
                      <div className="w-14 shrink-0 text-right text-[11px] font-bold text-slate-500">
                        Step {idx + 1}
                      </div>

                      <div className="flex flex-1 justify-center">
                        <div
                          className={`flex h-11 flex-col items-center justify-center bg-gradient-to-b ${styles[idx]} px-3 text-center transition-all duration-500`}
                          style={{
                            width: `${widthPct}%`,
                            clipPath: "polygon(0 0, 100% 0, 95% 100%, 5% 100%)",
                            borderRadius: "10px",
                          }}
                        >
                          <span className="truncate text-[10px] font-semibold opacity-90">
                            {step.label}
                          </span>
                          <span className="text-xs font-extrabold leading-tight">
                            {step.count} ta{" "}
                            <span className="text-[10px] font-semibold opacity-85">({pct}%)</span>
                          </span>
                        </div>
                      </div>

                      <div className="w-28 shrink-0">
                        {idx === maxDropIdx && maxDropVal > 0 ? (
                          <span className="inline-block rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">
                            Yo&apos;qotish: -{maxDropVal}
                          </span>
                        ) : idx === funnelSteps.length - 1 ? (
                          <span className="inline-block rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
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

        {/* Rad etish sabablari + Manbalar */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Nomzod manbalari va Sifati (Sourcing)
            </h3>
            {sourceStats.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">Ma&apos;lumot yo&apos;q</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {sourceStats.map((s) => (
                  <div key={s.source} className="rounded-xl bg-slate-50 p-2.5">
                    <div className="mb-1 flex items-center justify-between font-semibold">
                      <span className="text-slate-800">{s.source}</span>
                      <span className="text-slate-600">
                        {s.total} ta •{" "}
                        <span className="font-bold text-emerald-700">
                          {s.hired} qabul ({s.convPct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-emerald-500"
                        style={{
                          width: `${totalApps > 0 ? Math.max(6, Math.round((s.total / totalApps) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <XCircle className="h-4 w-4 text-rose-500" />
              Rad etish va Bekor qilish sabablari
            </h3>
            {rejectionReasons.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">Rad etilganlar yo&apos;q</p>
            ) : (
              <div className="space-y-2 text-xs">
                {rejectionReasons.slice(0, 6).map(([reason, cnt]) => (
                  <div key={reason} className="flex items-center justify-between rounded-xl bg-rose-50/50 px-3 py-2">
                    <span className="truncate pr-2 font-medium text-slate-700">{reason}</span>
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                      {cnt} ta
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kalendar: Qizil (ochildi) va Yashil (yopildi) */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="-mb-3.5 border-b-2 border-slate-900 pb-3 text-slate-900">
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

      {/* Filiallar kesimidagi talab va Shtat */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Building2 className="h-4 w-4 text-[#5865f2]" />
          Filiallar kesimidagi shtat to&apos;lishi va talab
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-semibold">Filial</th>
                <th className="pb-2.5 font-semibold">Shtat o&apos;rni</th>
                <th className="pb-2.5 font-semibold">Yopilgan</th>
                <th className="pb-2.5 font-semibold">To&apos;lish darajasi</th>
                <th className="pb-2.5 font-semibold">Arizalar</th>
                <th className="pb-2.5 font-semibold">Qabul qilindi</th>
                <th className="pb-2.5 font-semibold">Eng uzoq ochiq (kun)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchStats.map((b) => (
                <tr key={b.branch} className="hover:bg-slate-50">
                  <td className="py-3 font-bold text-slate-900">{b.branch}</td>
                  <td className="py-3">{b.headcount}</td>
                  <td className="py-3">{b.filled}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${b.fillPct}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700">{b.fillPct}%</span>
                    </div>
                  </td>
                  <td className="py-3">{b.apps}</td>
                  <td className="py-3 font-bold text-emerald-700">{b.hired}</td>
                  <td className="py-3 text-slate-600">{b.maxOpenDays} kun</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rekruterlar samaradorligi jadvali */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Users className="h-4 w-4 text-[#5865f2]" />
          Rekruterlar samaradorligi (Time to Fill & SLA)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2.5 font-semibold">Rekruter</th>
                <th className="pb-2.5 font-semibold">Vakansiyalar</th>
                <th className="pb-2.5 font-semibold">Qiziqish</th>
                <th className="pb-2.5 font-semibold">Qo&apos;ng&apos;iroq</th>
                <th className="pb-2.5 font-semibold">Rahbar</th>
                <th className="pb-2.5 font-semibold">Sinov kuni</th>
                <th className="pb-2.5 font-semibold">Offer</th>
                <th className="pb-2.5 font-semibold">Hujjatlar</th>
                <th className="pb-2.5 font-semibold text-emerald-700">Qabul</th>
                <th className="pb-2.5 font-semibold text-indigo-700">Time to Fill</th>
                <th className="pb-2.5 font-semibold">SLA %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recruiterRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedRecruiterId(r.id)}
                  className="cursor-pointer transition hover:bg-blue-50/40"
                >
                  <td className="py-3 font-bold text-slate-900">{r.fullName}</td>
                  <td className="py-3">{r.vacs}</td>
                  <td className="py-3">{r.total}</td>
                  <td className="py-3">{r.calls}</td>
                  <td className="py-3">{r.managers}</td>
                  <td className="py-3">{r.testDays}</td>
                  <td className="py-3">{r.offers}</td>
                  <td className="py-3">{r.docs}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                      <Award className="h-3 w-3" /> {r.hired}
                    </span>
                  </td>
                  <td className="py-3 font-bold text-indigo-700">{r.ttf}</td>
                  <td className="py-3 font-semibold text-slate-700">{r.slaPct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yo'nalishlar bo'yicha tezkor progress */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["dokon_xodimi", "dokon_rahbari", "ofis_xodimi", "ommaviy_yollash"] as TrackType[]).map(
          (tr, idx) => {
            const cfg = TRACK_CONFIGS[tr];
            const trApps = filteredApps.filter((a) => a.track === tr);
            const trVacs = filteredVacs.filter((v) => v.track === tr);
            const hiredInTrack = trApps.filter((a) => a.status === "hired").length;
            const pct = trApps.length > 0 ? Math.round((hiredInTrack / trApps.length) * 100) : 0;
            const isBlue = idx % 2 === 0;
            return (
              <div
                key={tr}
                className={`rounded-3xl p-5 text-white shadow-md ${
                  isBlue
                    ? "bg-gradient-to-br from-[#1b64f2] to-[#1149c7]"
                    : "bg-gradient-to-br from-[#18181b] to-[#09090b]"
                }`}
              >
                <p className="text-sm font-bold">{cfg.titleUz}</p>
                <p className="mt-2 text-2xl font-extrabold">{trApps.length} nomzod</p>
                <p className="mt-1 text-[11px] text-white/80">
                  {trVacs.length} vakansiya • {hiredInTrack} qabul ({pct}%)
                </p>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
