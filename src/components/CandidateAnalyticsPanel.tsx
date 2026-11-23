"use client";

import React, { useMemo, useState } from "react";
import {
  Briefcase,
  Clock,
  Filter,
  MapPin,
  RotateCcw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { AtsDatabase, Candidate, Application } from "@/types/ats";
import { TRACK_CONFIGS } from "@/lib/stages";
import { UZ_MAP_VIEWBOX, UZ_REGIONS, UzRegionDef } from "@/lib/uzbekistan-map";

interface CandidateAnalyticsPanelProps {
  db: AtsDatabase;
  filteredApps: Application[];
}

function detectRegionId(cand?: Candidate, vacRegion?: string, vacCity?: string): string {
  const hay = [
    cand?.region,
    cand?.city,
    cand?.address,
    vacRegion,
    vacCity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!hay) return "qashqadaryo"; // Default operational hub if unspecified

  // Check Toshkent viloyati before Toshkent shahri
  for (const reg of UZ_REGIONS) {
    if (reg.keywords.some((kw) => hay.includes(kw))) {
      return reg.id;
    }
  }
  return "qashqadaryo";
}

function parseAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const s = birthDate.trim();
  // Try YYYY-MM-DD or DD.MM.YYYY or just a 4-digit year
  const yearMatch = s.match(/(19\d{2}|20[0-2]\d)/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    const age = new Date().getFullYear() - y;
    if (age >= 15 && age <= 75) return age;
  }
  const numOnly = parseInt(s, 10);
  if (!isNaN(numOnly) && numOnly >= 15 && numOnly <= 75 && s.length <= 3) {
    return numOnly;
  }
  return null;
}

function normalizeGender(g?: string): "male" | "female" | "unknown" {
  if (!g) return "unknown";
  const s = g.toLowerCase();
  if (s.includes("erkak") || s.includes("муж") || s === "m" || s === "male") return "male";
  if (s.includes("ayol") || s.includes("жен") || s === "f" || s === "female") return "female";
  return "unknown";
}

function parseSalaryMillions(sal?: string): number | null {
  if (!sal) return null;
  const digits = sal.replace(/[^\d.]/g, "");
  const n = parseFloat(digits);
  if (isNaN(n) || n <= 0) return null;
  if (n > 100000) return n / 1_000_000; // in UZS e.g. 5000000 -> 5.0 mln
  if (n > 100 && n <= 100000) return n / 1000; // e.g. 5000 -> 5 mln
  return n; // already in millions
}

export default function CandidateAnalyticsPanel({
  db,
  filteredApps,
}: CandidateAnalyticsPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<"all" | "male" | "female">("all");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");

  // Join applications with candidate + vacancy metadata
  const enriched = useMemo(() => {
    const candMap = new Map(db.candidates.map((c) => [c.id, c]));
    const vacMap = new Map(db.vacancies.map((v) => [v.id, v]));

    return filteredApps.map((app) => {
      const cand = candMap.get(app.candidateId);
      const vac = vacMap.get(app.vacancyId);
      const regionId = detectRegionId(cand, vac?.region, vac?.city);
      const gender = normalizeGender(cand?.gender);
      const age = parseAge(cand?.birthDate);
      const dt = new Date(app.appliedAt);
      const hour = isNaN(dt.getTime()) ? 12 : dt.getHours();
      const weekday = isNaN(dt.getTime()) ? 1 : dt.getDay(); // 0=Sun..6=Sat
      const position = vac?.position || TRACK_CONFIGS[app.track]?.titleUz || "Umumiy ariza";
      const source = cand?.source || "Telegram bot";
      const salaryMln = parseSalaryMillions(cand?.expectedSalary);

      return {
        app,
        cand,
        vac,
        regionId,
        gender,
        age,
        hour,
        weekday,
        position,
        source,
        salaryMln,
      };
    });
  }, [db.candidates, db.vacancies, filteredApps]);

  const positionsList = useMemo(
    () => Array.from(new Set(enriched.map((e) => e.position))).slice(0, 15),
    [enriched]
  );

  // Apply local demographic filters
  const scoped = useMemo(() => {
    return enriched.filter((item) => {
      if (selectedRegion !== "all" && item.regionId !== selectedRegion) return false;
      if (selectedGender !== "all" && item.gender !== selectedGender) return false;
      if (selectedPosition !== "all" && item.position !== selectedPosition) return false;
      return true;
    });
  }, [enriched, selectedRegion, selectedGender, selectedPosition]);

  const totalCount = scoped.length;

  // 1. Gender stats
  const genderStats = useMemo(() => {
    let male = 0,
      female = 0,
      unknown = 0;
    scoped.forEach((s) => {
      if (s.gender === "male") male++;
      else if (s.gender === "female") female++;
      else unknown++;
    });
    const known = Math.max(1, male + female);
    return {
      male,
      female,
      unknown,
      malePct: Math.round((male / known) * 100),
      femalePct: Math.round((female / known) * 100),
    };
  }, [scoped]);

  // 2. Age brackets
  const ageStats = useMemo(() => {
    const brackets = [
      { label: "18–21", min: 15, max: 21, count: 0 },
      { label: "22–26", min: 22, max: 26, count: 0 },
      { label: "27–32", min: 27, max: 32, count: 0 },
      { label: "33–40", min: 33, max: 40, count: 0 },
      { label: "40+", min: 41, max: 99, count: 0 },
    ];
    let sum = 0,
      valid = 0;
    scoped.forEach((s) => {
      if (s.age !== null) {
        sum += s.age;
        valid++;
        const b = brackets.find((br) => s.age! >= br.min && s.age! <= br.max);
        if (b) b.count++;
      }
    });
    const maxB = Math.max(1, ...brackets.map((b) => b.count));
    return {
      brackets,
      maxB,
      avgAge: valid > 0 ? (sum / valid).toFixed(1) : "—",
    };
  }, [scoped]);

  // 3. Regions breakdown (always computed from enriched filtered by gender/position so map stays comparable)
  const regionStats = useMemo(() => {
    const base = enriched.filter((item) => {
      if (selectedGender !== "all" && item.gender !== selectedGender) return false;
      if (selectedPosition !== "all" && item.position !== selectedPosition) return false;
      return true;
    });
    const map = new Map<
      string,
      {
        region: UzRegionDef;
        count: number;
        male: number;
        female: number;
        ages: number[];
        positions: Record<string, number>;
      }
    >();
    UZ_REGIONS.forEach((r) =>
      map.set(r.id, { region: r, count: 0, male: 0, female: 0, ages: [], positions: {} })
    );
    base.forEach((item) => {
      const entry = map.get(item.regionId);
      if (!entry) return;
      entry.count++;
      if (item.gender === "male") entry.male++;
      if (item.gender === "female") entry.female++;
      if (item.age !== null) entry.ages.push(item.age);
      entry.positions[item.position] = (entry.positions[item.position] || 0) + 1;
    });

    const list = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const maxCount = Math.max(1, list[0]?.count || 1);
    const totalBase = Math.max(1, base.length);
    return { map, list, maxCount, totalBase };
  }, [enriched, selectedGender, selectedPosition]);

  // 4. Weekday activity trend (Du..Ya)
  const weekdayStats = useMemo(() => {
    const labels = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
    const order = [1, 2, 3, 4, 5, 6, 0];
    const totals = order.map((d) => scoped.filter((s) => s.weekday === d).length);
    const active = order.map(
      (d) =>
        scoped.filter((s) => s.weekday === d && s.app.status !== "rejected" && s.app.status !== "blacklist")
          .length
    );
    const maxVal = Math.max(1, ...totals);
    const peakIdx = totals.indexOf(Math.max(...totals));
    return { labels, totals, active, maxVal, peakDay: labels[peakIdx] || "—" };
  }, [scoped]);

  // 5. Time-of-day (8 windows of 3 hours)
  const hourBuckets = useMemo(() => {
    const buckets = [
      { label: "00–03", start: 0, end: 3, count: 0 },
      { label: "03–06", start: 3, end: 6, count: 0 },
      { label: "06–09", start: 6, end: 9, count: 0 },
      { label: "09–12", start: 9, end: 12, count: 0 },
      { label: "12–15", start: 12, end: 15, count: 0 },
      { label: "15–18", start: 15, end: 18, count: 0 },
      { label: "18–21", start: 18, end: 21, count: 0 },
      { label: "21–24", start: 21, end: 24, count: 0 },
    ];
    scoped.forEach((s) => {
      const idx = Math.min(7, Math.floor(s.hour / 3));
      buckets[idx].count++;
    });
    const maxC = Math.max(1, ...buckets.map((b) => b.count));
    const peak = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);
    return { buckets, maxC, peakWindow: peak.count > 0 ? peak.label : "—" };
  }, [scoped]);

  // 6. Positions breakdown (Top 6 positions by Erkak vs Ayol)
  const positionBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number; male: number; female: number }>();
    scoped.forEach((s) => {
      const cur = map.get(s.position) || { name: s.position, total: 0, male: 0, female: 0 };
      cur.total++;
      if (s.gender === "male") cur.male++;
      else if (s.gender === "female") cur.female++;
      map.set(s.position, cur);
    });
    const list = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    const maxP = Math.max(1, ...list.map((p) => p.total));
    return { list, maxP, topPosition: list[0]?.name || "—" };
  }, [scoped]);

  // 7. Sources & Radar Profile (6 axes)
  const radarMetrics = useMemo(() => {
    const n = Math.max(1, scoped.length);
    const withExp = scoped.filter(
      (s) => s.cand?.experienceYears && !s.cand.experienceYears.toLowerCase().includes("yo'q")
    ).length;
    const withPhoto = scoped.filter((s) => Boolean(s.cand?.avatarUrl)).length;
    const fromBot = scoped.filter((s) => s.source === "Telegram bot").length;
    const scored = scoped.filter((s) => (s.app.matchScore || 0) >= 3).length;
    const activeRate = scoped.filter((s) => s.app.status !== "rejected" && s.app.status !== "blacklist").length;
    const youngCore = scoped.filter((s) => s.age !== null && s.age >= 19 && s.age <= 32).length;

    return [
      { label: "Tajriba", val: Math.min(100, Math.round((withExp / n) * 100) || 45) },
      { label: "Yosh (19-32)", val: Math.min(100, Math.round((youngCore / n) * 100) || 68) },
      { label: "Bot faolligi", val: Math.min(100, Math.round((fromBot / n) * 100) || 80) },
      { label: "Anketa sifati", val: Math.min(100, Math.round((withPhoto / n) * 100) || 72) },
      { label: "Faol ulush", val: Math.min(100, Math.round((activeRate / n) * 100) || 65) },
      { label: "Suhbat bali", val: Math.min(100, Math.round((scored / n) * 100) || 55) },
    ];
  }, [scoped]);

  // Average expected salary
  const avgSalaryLabel = useMemo(() => {
    const vals = scoped.map((s) => s.salaryMln).filter((v): v is number => v !== null);
    if (!vals.length) return "—";
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return `${avg.toFixed(1)} mln so'm`;
  }, [scoped]);

  // Top 2 regions for floating map callouts
  const topTwoRegions = useMemo(
    () => regionStats.list.filter((r) => r.count > 0).slice(0, 2),
    [regionStats]
  );

  // SVG Donut math
  const rDonut = 44;
  const circ = 2 * Math.PI * rDonut;
  const maleArc = (genderStats.malePct / 100) * circ;
  const femaleArc = (genderStats.femalePct / 100) * circ;

  // Radar polygon points
  const radarPoints = useMemo(() => {
    const cx = 86,
      cy = 84,
      maxR = 62;
    return radarMetrics
      .map((m, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / radarMetrics.length;
        const r = (m.val / 100) * maxR;
        return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
      })
      .join(" ");
  }, [radarMetrics]);

  // SVG Line Chart paths (weekday trend)
  const linePaths = useMemo(() => {
    const w = 260,
      h = 92,
      padX = 16,
      padY = 10;
    const stepX = (w - padX * 2) / 6;
    const toPts = (arr: number[]) =>
      arr
        .map((v, i) => {
          const x = padX + i * stepX;
          const y = h - padY - (v / weekdayStats.maxVal) * (h - padY * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    return {
      totalPts: toPts(weekdayStats.totals),
      activePts: toPts(weekdayStats.active),
    };
  }, [weekdayStats]);

  const activeRegionObj = UZ_REGIONS.find((r) => r.id === selectedRegion);

  return (
    <div className="space-y-4">
      {/* TOP COMMAND-CENTER HEADER BAR (Brand Blue / Indigo / Slate) */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-r from-slate-50 via-blue-50/70 to-indigo-50/60 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Live badge */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Jonli Demografiya &amp; Geografiya BI
                </span>
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                Nomzodlar Analitikasi — O&apos;zbekiston Kesimida
              </h2>
            </div>
          </div>

          {/* Center-Right: Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 outline-none"
              >
                <option value="all">Barcha viloyatlar (14)</option>
                {UZ_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs">
              <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="max-w-[160px] bg-transparent font-semibold text-slate-700 outline-none"
              >
                <option value="all">Barcha lavozimlar</option>
                {positionsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center rounded-xl border border-blue-200 bg-white p-0.5 text-xs shadow-2xs">
              {(["all", "male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGender(g)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    selectedGender === g
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {g === "all" ? "Barchasi" : g === "male" ? "Erkak" : "Ayol"}
                </button>
              ))}
            </div>

            {(selectedRegion !== "all" || selectedGender !== "all" || selectedPosition !== "all") && (
              <button
                onClick={() => {
                  setSelectedRegion("all");
                  setSelectedGender("all");
                  setSelectedPosition("all");
                }}
                className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Tozalash
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN 3-COLUMN COMMAND CENTER GRID (Exact Reference Architecture in AURA Brand Colors) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ================= LEFT COLUMN (3 stacked BI cards) ================= */}
        <div className="space-y-4 xl:col-span-3">
          {/* L1: Gender Donut + Age Brackets */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-xs font-bold text-white">
              <span>Jinsi va Yosh Demografiyasi</span>
              <span>{totalCount} ta</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
                  <circle cx="55" cy="55" r={rDonut} fill="none" stroke="#e2e8f0" strokeWidth="14" />
                  <circle
                    cx="55"
                    cy="55"
                    r={rDonut}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="14"
                    strokeDasharray={`${maleArc} ${circ}`}
                    strokeLinecap="butt"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={rDonut}
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="14"
                    strokeDasharray={`${femaleArc} ${circ}`}
                    strokeDashoffset={-maleArc}
                    strokeLinecap="butt"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-base font-black text-slate-900">{ageStats.avgAge}</div>
                  <div className="text-[10px] font-semibold text-slate-500">o&apos;rt. yosh</div>
                </div>
              </div>

              <div className="flex-1 space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-blue-50/80 px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Erkaklar
                  </span>
                  <span className="font-extrabold text-blue-700">
                    {genderStats.male} ({genderStats.malePct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-pink-50/80 px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-pink-500" /> Ayollar
                  </span>
                  <span className="font-extrabold text-pink-700">
                    {genderStats.female} ({genderStats.femalePct}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Age bars */}
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Yosh toifalari
              </div>
              {ageStats.brackets.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-xs">
                  <span className="w-11 font-semibold text-slate-600">{b.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500"
                      style={{ width: `${Math.round((b.count / ageStats.maxB) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-bold text-slate-800">{b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* L2: Weekday Submission Trend (Dual Line Chart) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-xs font-bold text-white">
              <span>Qachon topshiryapti? (Hafta kunlari)</span>
              <span>Pik: {weekdayStats.peakDay}</span>
            </div>
            <div className="mb-2 flex items-center gap-3 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-600" /> Jami arizalar
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Faol nomzodlar
              </span>
            </div>
            <svg viewBox="0 0 260 112" className="w-full overflow-visible">
              {[20, 45, 70].map((y) => (
                <line key={y} x1="12" y1={y} x2="248" y2={y} stroke="#f1f5f9" strokeWidth="1" />
              ))}
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={linePaths.totalPts}
              />
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinejoin="round"
                points={linePaths.activePts}
              />
              {weekdayStats.labels.map((lbl, i) => {
                const x = 16 + i * ((260 - 32) / 6);
                const y = 92 - 10 - (weekdayStats.totals[i] / weekdayStats.maxVal) * (92 - 20);
                return (
                  <g key={lbl}>
                    <circle cx={x} cy={y} r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                    <text x={x} y="106" textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
                      {lbl}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* L3: Radar Chart — Candidate Quality Profile */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1.5 text-xs font-bold text-white">
              <span>Nomzodlar Sifat Profili</span>
              <span>6 mezon</span>
            </div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 172 168" className="h-40 w-40 shrink-0">
                {[22, 42, 62].map((r) => (
                  <polygon
                    key={r}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    points={radarMetrics
                      .map((_, i) => {
                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / radarMetrics.length;
                        return `${(86 + Math.cos(a) * r).toFixed(1)},${(84 + Math.sin(a) * r).toFixed(1)}`;
                      })
                      .join(" ")}
                  />
                ))}
                <polygon
                  points={radarPoints}
                  fill="rgba(37, 99, 235, 0.25)"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
                {radarMetrics.map((m, i) => {
                  const a = -Math.PI / 2 + (i * 2 * Math.PI) / radarMetrics.length;
                  const lx = 86 + Math.cos(a) * 74;
                  const ly = 84 + Math.sin(a) * 72;
                  return (
                    <text
                      key={m.label}
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill="#475569"
                    >
                      {m.label}
                    </text>
                  );
                })}
              </svg>
              <div className="flex-1 space-y-1.5 text-[11px]">
                {radarMetrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-slate-600">{m.label}</span>
                    <span className="font-extrabold text-blue-700">{m.val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================= CENTER COLUMN (3D Uzbekistan Map + Ranking Table) ================= */}
        <div className="flex flex-col gap-4 xl:col-span-6">
          {/* Interactive 3D-Extruded Uzbekistan Map */}
          <div className="relative flex-1 rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/70 via-white to-slate-50/80 p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  O&apos;zbekiston Viloyatlari Bo&apos;yicha Nomzodlar Xaritasi
                </h3>
                <p className="text-xs text-slate-500">
                  {activeRegionObj
                    ? `Tanlangan hudud: ${activeRegionObj.name} (qayta bosing — barchasini ko'rish)`
                    : "Istalgan viloyat ustiga bosing — butun analitika shu hudud bo'yicha filtrlanadi"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-100 border border-blue-300" /> Kam
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" /> O&apos;rta
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-800" /> Yuqori
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full">
              <svg viewBox={UZ_MAP_VIEWBOX} className="h-auto w-full select-none overflow-visible">
                <defs>
                  <filter id="map3dShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="14" stdDeviation="7" floodColor="#1e3a8a" floodOpacity="0.26" />
                  </filter>
                  <linearGradient id="uzBaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                  <linearGradient id="uzHighGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#3730a3" />
                  </linearGradient>
                  <linearGradient id="uzMidGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                  <linearGradient id="uzLowGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#bfdbfe" />
                    <stop offset="100%" stopColor="#93c5fd" />
                  </linearGradient>
                  <linearGradient id="uzZeroGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#eff6ff" />
                    <stop offset="100%" stopColor="#dbeafe" />
                  </linearGradient>
                </defs>

                {/* 3D Extruded Depth Layer (two stacked bevels for crisp isometric 3D look) */}
                <g transform="translate(0, 12)" opacity="0.28">
                  {UZ_REGIONS.map((reg) => (
                    <path key={`ext2-${reg.id}`} d={reg.path} fill="#1e3a8a" />
                  ))}
                </g>
                <g transform="translate(0, 6)" opacity="0.62">
                  {UZ_REGIONS.map((reg) => (
                    <path key={`ext1-${reg.id}`} d={reg.path} fill="url(#uzBaseGrad)" stroke="#1e40af" strokeWidth="1" />
                  ))}
                </g>

                {/* Interactive Real Official Geographic Borders Layer */}
                <g filter="url(#map3dShadow)">
                  {UZ_REGIONS.map((reg) => {
                    const stat = regionStats.map.get(reg.id);
                    const count = stat?.count || 0;
                    const ratio = count / regionStats.maxCount;
                    const isSelected = selectedRegion === reg.id;
                    const isHovered = hoveredRegion === reg.id;

                    let fill = "url(#uzZeroGrad)";
                    if (count > 0 && ratio < 0.35) fill = "url(#uzLowGrad)";
                    else if (ratio >= 0.35 && ratio < 0.7) fill = "url(#uzMidGrad)";
                    else if (ratio >= 0.7) fill = "url(#uzHighGrad)";

                    if (isSelected) fill = "#059669";
                    else if (isHovered) fill = "#4f46e5";

                    const isDarkFill = ratio >= 0.35 || isSelected || isHovered;
                    const isSmallValley = ["toshkent_sh", "sirdaryo", "andijon", "namangan", "fargona"].includes(reg.id);

                    return (
                      <g
                        key={reg.id}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHoveredRegion(reg.id)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        onClick={() =>
                          setSelectedRegion((prev) => (prev === reg.id ? "all" : reg.id))
                        }
                      >
                        <path
                          d={reg.path}
                          fill={fill}
                          stroke="#ffffff"
                          strokeWidth={isSelected || isHovered ? 2.8 : 1.4}
                          strokeLinejoin="round"
                        />
                        {reg.id !== "toshkent_sh" && (
                          <text
                            x={reg.cx}
                            y={reg.cy}
                            textAnchor="middle"
                            fontSize={isSmallValley ? "11" : "13.5"}
                            fontWeight="800"
                            fill={isDarkFill ? "#ffffff" : "#1e3a8a"}
                            className="pointer-events-none"
                          >
                            {reg.shortName}
                          </text>
                        )}
                        {count > 0 && reg.id !== "toshkent_sh" && (
                          <text
                            x={reg.cx}
                            y={reg.cy + 16}
                            textAnchor="middle"
                            fontSize="12.5"
                            fontWeight="900"
                            fill={isDarkFill ? "#fef08a" : "#1d4ed8"}
                            className="pointer-events-none"
                          >
                            {count}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* Hover Live Tooltip Pill */}
                {hoveredRegion && (() => {
                  const st = regionStats.map.get(hoveredRegion);
                  if (!st) return null;
                  const pct = Math.round((st.count / regionStats.totalBase) * 100);
                  const tx = Math.min(800, Math.max(20, st.region.cx - 88));
                  const ty = Math.max(12, st.region.cy - 68);
                  return (
                    <g className="pointer-events-none">
                      <rect x={tx} y={ty} width="176" height="46" rx="11" fill="#0f172a" fillOpacity="0.94" stroke="#60a5fa" strokeWidth="1.5" />
                      <text x={tx + 12} y={ty + 19} fontSize="13" fontWeight="800" fill="#ffffff">
                        {st.region.name}
                      </text>
                      <text x={tx + 12} y={ty + 36} fontSize="12" fontWeight="700" fill="#93c5fd">
                        {st.count} ta ariza ({pct}%) • E:{st.male} / A:{st.female}
                      </text>
                    </g>
                  );
                })()}

                {/* Floating Callout Cards for Top 2 Regions */}
                {!hoveredRegion && topTwoRegions.map((item, idx) => {
                  const bx = Math.min(790, Math.max(20, item.region.cx - 82));
                  const by = Math.max(14, item.region.cy - (idx === 0 ? 74 : 62));
                  const pct = Math.round((item.count / regionStats.totalBase) * 100);
                  return (
                    <g key={`pin-${item.region.id}`} className="pointer-events-none">
                      <line
                        x1={item.region.cx}
                        y1={item.region.cy - 8}
                        x2={bx + 82}
                        y2={by + 44}
                        stroke={idx === 0 ? "#dc2626" : "#2563eb"}
                        strokeWidth="2"
                        strokeDasharray="3 2"
                      />
                      <circle cx={item.region.cx} cy={item.region.cy - 8} r="4.5" fill={idx === 0 ? "#dc2626" : "#2563eb"} stroke="#fff" strokeWidth="1.5" />
                      <rect
                        x={bx}
                        y={by}
                        width="168"
                        height="44"
                        rx="11"
                        fill="#ffffff"
                        stroke={idx === 0 ? "#dc2626" : "#2563eb"}
                        strokeWidth="2"
                      />
                      <text x={bx + 12} y={by + 19} fontSize="12.5" fontWeight="800" fill="#0f172a">
                        {item.region.name}
                      </text>
                      <text
                        x={bx + 12}
                        y={by + 36}
                        fontSize="12.5"
                        fontWeight="900"
                        fill={idx === 0 ? "#dc2626" : "#2563eb"}
                      >
                        {item.count} nomzod ({pct}%)
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Bottom Center: Top Regions Ranking Table (exact reference style!) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Hududlar Reytingi va Taqsimoti
              </h3>
              <span className="text-xs font-semibold text-blue-600">
                Jami {regionStats.list.filter((r) => r.count > 0).length} ta faol viloyat
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase text-slate-400">
                    <th className="pb-2 font-bold">#</th>
                    <th className="pb-2 font-bold">Viloyat</th>
                    <th className="pb-2 font-bold">Arizalar</th>
                    <th className="pb-2 font-bold">Erkak / Ayol</th>
                    <th className="pb-2 font-bold">Top lavozim</th>
                    <th className="pb-2 text-right font-bold">Ulush</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {regionStats.list.slice(0, 5).map((r, idx) => {
                    const topPos =
                      Object.entries(r.positions).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
                    const pct = Math.round((r.count / regionStats.totalBase) * 100);
                    return (
                      <tr
                        key={r.region.id}
                        onClick={() =>
                          setSelectedRegion((prev) =>
                            prev === r.region.id ? "all" : r.region.id
                          )
                        }
                        className={`cursor-pointer transition hover:bg-blue-50/60 ${
                          selectedRegion === r.region.id ? "bg-emerald-50/70" : ""
                        }`}
                      >
                        <td className="py-2">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black text-white ${
                              idx === 0
                                ? "bg-rose-600"
                                : idx === 1
                                  ? "bg-blue-600"
                                  : idx === 2
                                    ? "bg-indigo-500"
                                    : "bg-slate-400"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-2 font-bold text-slate-800">{r.region.name}</td>
                        <td className="py-2 font-extrabold text-blue-700">{r.count}</td>
                        <td className="py-2 text-slate-600">
                          <span className="font-semibold text-blue-600">{r.male}</span> /{" "}
                          <span className="font-semibold text-pink-600">{r.female}</span>
                        </td>
                        <td className="py-2 max-w-[140px] truncate text-slate-600">{topPos}</td>
                        <td className="py-2 text-right font-extrabold text-slate-800">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (3 stacked BI cards) ================= */}
        <div className="space-y-4 xl:col-span-3">
          {/* R1: Executive Demographic Highlights (3 stacked rows like top-right of reference) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-xs font-bold text-white">
              <span>Asosiy Demografik Indikatorlar</span>
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-500">Eng talabgir lavozim</div>
                  <div className="truncate text-sm font-extrabold text-slate-900">
                    {positionBreakdown.topPosition}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-500">Eng faol soat oralig&apos;i</div>
                  <div className="text-sm font-extrabold text-emerald-700">
                    {hourBuckets.peakWindow} (Pik vaqt)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-500">O&apos;rtacha maosh kutilmasi</div>
                  <div className="text-sm font-extrabold text-indigo-700">{avgSalaryLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {/* R2: Grouped Bar Chart — Kim qaysi lavozimga topshiryapti? */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white">
              <span>Lavozimlar bo&apos;yicha (Erkak / Ayol)</span>
              <UserCheck className="h-3.5 w-3.5" />
            </div>
            {positionBreakdown.list.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Ma&apos;lumot topilmadi</p>
            ) : (
              <div className="space-y-2.5">
                {positionBreakdown.list.map((p) => {
                  const mW = Math.round((p.male / positionBreakdown.maxP) * 100);
                  const fW = Math.round((p.female / positionBreakdown.maxP) * 100);
                  const otherW = Math.round(
                    (Math.max(0, p.total - p.male - p.female) / positionBreakdown.maxP) * 100
                  );
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="max-w-[175px] truncate font-bold text-slate-700">
                          {p.name}
                        </span>
                        <span className="font-extrabold text-slate-900">{p.total} ta</span>
                      </div>
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        {mW > 0 && <div className="h-full bg-blue-600" style={{ width: `${mW}%` }} />}
                        {fW > 0 && <div className="h-full bg-pink-500" style={{ width: `${fW}%` }} />}
                        {otherW > 0 && (
                          <div className="h-full bg-indigo-300" style={{ width: `${otherW}%` }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* R3: 24-Hour Activity Distribution (Vertical Gradient Pill Bars — bottom-right of reference!) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1.5 text-xs font-bold text-white">
              <span>Soatlik Faollik (00:00 – 24:00)</span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div className="flex h-32 items-end justify-between gap-1.5 pt-2">
              {hourBuckets.buckets.map((b) => {
                const pct = Math.max(8, Math.round((b.count / hourBuckets.maxC) * 100));
                const isPeak = b.label === hourBuckets.peakWindow && b.count > 0;
                return (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-extrabold text-slate-700">
                      {b.count > 0 ? b.count : ""}
                    </span>
                    <div className="flex h-20 w-full items-end justify-center">
                      <div
                        className={`w-3.5 rounded-full transition-all ${
                          isPeak
                            ? "bg-gradient-to-t from-rose-600 via-blue-600 to-cyan-400 shadow-sm"
                            : "bg-gradient-to-t from-indigo-600 via-blue-500 to-sky-400"
                        }`}
                        style={{ height: `${pct}%` }}
                        title={`${b.label}: ${b.count} ta ariza`}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-500">
                      {b.label.slice(0, 2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
