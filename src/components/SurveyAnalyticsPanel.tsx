"use client";

import React, { useMemo } from "react";
import { Building2, MessageSquareText, Star, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { Application, AtsDatabase } from "@/types/ats";

interface SurveyAnalyticsPanelProps {
  db: AtsDatabase;
  filteredApps: Application[];
}

function extractNumericRating(ans: string): number | null {
  const m = String(ans || "").trim().match(/^([1-5])(?:\s|\/|⭐|$)/);
  if (m) return parseInt(m[1], 10);
  const n = Number(ans);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  return null;
}

export default function SurveyAnalyticsPanel({
  db,
  filteredApps,
}: SurveyAnalyticsPanelProps) {
  const appIdSet = useMemo(() => new Set(filteredApps.map((a) => a.id)), [filteredApps]);
  const appMap = useMemo(() => new Map(db.applications.map((a) => [a.id, a])), [db.applications]);
  const candMap = useMemo(() => new Map(db.candidates.map((c) => [c.id, c])), [db.candidates]);
  const vacMap = useMemo(() => new Map(db.vacancies.map((v) => [v.id, v])), [db.vacancies]);

  const rows = useMemo(() => {
    const flows = (db.onboardingFlows || []).filter(
      (f) => f.surveyAnswers && f.surveyAnswers.length > 0 && appIdSet.has(f.applicationId)
    );

    return flows.map((f) => {
      const app = appMap.get(f.applicationId);
      const cand = candMap.get(f.candidateId);
      const vac = app ? vacMap.get(app.vacancyId) : undefined;

      const ratings: number[] = [];
      const textNotes: { q: string; a: string }[] = [];

      f.surveyAnswers.forEach((item) => {
        const r = extractNumericRating(item.answer);
        if (r !== null) ratings.push(r);
        else if (item.answer && item.answer.trim()) {
          textNotes.push({ q: item.question, a: item.answer.trim() });
        }
      });

      const avgRating =
        ratings.length > 0
          ? Number((ratings.reduce((s, v) => s + v, 0) / ratings.length).toFixed(1))
          : null;

      // Determine satisfaction outcome from step/status
      const declined =
        f.step === "declined" ||
        (app?.status === "rejected" &&
          (app.rejectionReason || "").toLowerCase().includes("sinov"));
      const satisfied =
        !declined &&
        (f.step === "completed" ||
          f.step.startsWith("awaiting_passport") ||
          f.step === "awaiting_doc_phone" ||
          f.step === "awaiting_photo_3x4" ||
          f.step === "awaiting_data_consent" ||
          f.step === "awaiting_welcome_ack" ||
          (avgRating !== null && avgRating >= 4));

      return {
        flow: f,
        candidateName: cand?.fullName || "Nomzod",
        phone: cand?.phone || "—",
        branch: vac?.branch || "—",
        position: vac?.position || "—",
        testDate: f.testDate || "—",
        avgRating,
        ratings,
        textNotes,
        satisfied,
        declined,
      };
    });
  }, [db.onboardingFlows, appIdSet, appMap, candMap, vacMap]);

  const summary = useMemo(() => {
    const total = rows.length;
    const satCount = rows.filter((r) => r.satisfied).length;
    const decCount = rows.filter((r) => r.declined).length;
    const csat = total > 0 ? Math.round((satCount / total) * 100) : 0;

    const validRatings = rows.map((r) => r.avgRating).filter((v): v is number => v !== null);
    const overallAvg =
      validRatings.length > 0
        ? (validRatings.reduce((s, v) => s + v, 0) / validRatings.length).toFixed(1)
        : "—";

    // Branch ratings
    const branchMap = new Map<string, { branch: string; sum: number; count: number; sat: number; total: number }>();
    rows.forEach((r) => {
      const cur = branchMap.get(r.branch) || {
        branch: r.branch,
        sum: 0,
        count: 0,
        sat: 0,
        total: 0,
      };
      cur.total++;
      if (r.satisfied) cur.sat++;
      if (r.avgRating !== null) {
        cur.sum += r.avgRating;
        cur.count++;
      }
      branchMap.set(r.branch, cur);
    });
    const branches = Array.from(branchMap.values())
      .map((b) => ({
        branch: b.branch,
        avg: b.count > 0 ? Number((b.sum / b.count).toFixed(1)) : 0,
        csat: b.total > 0 ? Math.round((b.sat / b.total) * 100) : 0,
        total: b.total,
      }))
      .sort((a, b) => b.avg - a.avg);

    // Per-question ratings
    const qMap = new Map<string, { question: string; sum: number; count: number }>();
    rows.forEach((r) => {
      r.flow.surveyAnswers.forEach((ans) => {
        const num = extractNumericRating(ans.answer);
        if (num !== null) {
          const cur = qMap.get(ans.question) || { question: ans.question, sum: 0, count: 0 };
          cur.sum += num;
          cur.count++;
          qMap.set(ans.question, cur);
        }
      });
    });
    const questions = Array.from(qMap.values()).map((q) => ({
      question: q.question,
      avg: Number((q.sum / q.count).toFixed(1)),
      count: q.count,
    }));

    return { total, satCount, decCount, csat, overallAvg, branches, questions };
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* Top 4 CSAT KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <ThumbsUp className="h-4 w-4" /> Qoniqish darajasi (CSAT)
          </p>
          <p className="mt-1.5 text-3xl font-black text-emerald-700">
            {summary.total > 0 ? `${summary.csat}%` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {summary.satCount} ta ijobiy / {summary.total} ta javob
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> O&apos;rtacha baho (1–5)
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">
            {summary.overallAvg} {summary.overallAvg !== "—" && <span className="text-lg text-amber-500">★</span>}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Sinov kuni baholari o&apos;rtachasi</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
            <Users className="h-4 w-4" /> So&apos;rovnomadan o&apos;tganlar
          </p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{summary.total}</p>
          <p className="mt-1 text-[11px] text-slate-500">Sinov kunini yakunlagan nomzodlar</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-xs">
          <p className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
            <ThumbsDown className="h-4 w-4" /> Ma&apos;qul kelmaganlar
          </p>
          <p className="mt-1.5 text-3xl font-black text-rose-600">{summary.decCount}</p>
          <p className="mt-1 text-[11px] text-slate-500">Sinovdan keyin rad etganlar</p>
        </div>
      </div>

      {summary.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Star className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <h3 className="text-base font-extrabold text-slate-900">
            Hozircha sinov kuni so&apos;rovnomasi javoblari kelib tushmagan
          </h3>
          <p className="mx-auto mt-1.5 max-w-lg text-xs text-slate-500">
            Nomzod <b>«1 kunlik sinov kuni»</b> bosqichini yakunlab, Telegram botdagi 1–5 balli so&apos;rovnomaga javob berishi bilan bu yerda filiallar reytingi, CSAT foizi va barcha ochiq izohlar avtomatik paydo bo&apos;ladi.
          </p>
        </div>
      ) : (
        <>
          {/* Branch Rating + Per-Question Breakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Building2 className="h-4 w-4 text-blue-600" /> Filiallar bo&apos;yicha qoniqish reytingi
              </h3>
              <div className="space-y-3">
                {summary.branches.map((b) => (
                  <div key={b.branch} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{b.branch}</span>
                      <span className="font-extrabold text-slate-900">
                        {b.avg > 0 ? `${b.avg} ★` : "—"} • CSAT {b.csat}% ({b.total} ta)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          b.csat >= 80
                            ? "bg-emerald-500"
                            : b.csat >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.max(8, b.csat)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Star className="h-4 w-4 text-amber-500" /> Savollar kesimida o&apos;rtacha ball
              </h3>
              {summary.questions.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  1–5 balli savollar javoblari hali mavjud emas
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.questions.map((q) => (
                    <div key={q.question} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="line-clamp-1 font-semibold text-slate-700">{q.question}</span>
                        <span className="shrink-0 font-extrabold text-amber-600">
                          {q.avg} / 5 ({q.count})
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                          style={{ width: `${Math.round((q.avg / 5) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* All Candidate Feedback Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <MessageSquareText className="h-4 w-4 text-indigo-600" /> Nomzodlarning barcha javoblari va ochiq izohlari
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase text-slate-400">
                    <th className="pb-2.5 font-bold">Nomzod</th>
                    <th className="pb-2.5 font-bold">Filial / Lavozim</th>
                    <th className="pb-2.5 font-bold">Sinov sanasi</th>
                    <th className="pb-2.5 font-bold">Baho</th>
                    <th className="pb-2.5 font-bold">Qaror</th>
                    <th className="pb-2.5 font-bold">Ochiq fikrlar / Javoblar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.flow.id} className="align-top hover:bg-slate-50/70">
                      <td className="py-3 pr-3">
                        <div className="font-bold text-slate-900">{r.candidateName}</div>
                        <div className="text-[11px] text-slate-400">{r.phone}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-800">{r.branch}</div>
                        <div className="text-[11px] text-slate-500">{r.position}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{r.testDate}</td>
                      <td className="py-3 pr-3 font-extrabold text-amber-600">
                        {r.avgRating !== null ? `${r.avgRating} ★` : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        {r.declined ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                            Ma&apos;qul emas
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            Ma&apos;qul
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-700">
                        {r.textNotes.length > 0 ? (
                          <div className="space-y-1">
                            {r.textNotes.map((n, idx) => (
                              <div key={idx}>
                                <span className="font-semibold text-slate-500">{n.q}: </span>
                                <span>{n.a}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Faqat baho qo&apos;yilgan</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
