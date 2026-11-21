"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Bookmark,
  CheckCircle2,
  GraduationCap,
  Info,
  MapPin,
  Phone,
  Star,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Application, AtsDatabase, Language, User } from "@/types/ats";
import {
  EVALUATION_CRITERIA_BY_TRACK,
  TRACK_CONFIGS,
  getStageLabel,
  getTrackTitle,
} from "@/lib/stages";
import { UI_TEXT } from "@/lib/i18n";

interface CandidateDrawerProps {
  application: Application;
  db: AtsDatabase;
  currentUser: User;
  lang: Language;
  onClose: () => void;
  onUpdateDb: (db: AtsDatabase) => void;
}

export default function CandidateDrawer({
  application,
  db,
  currentUser,
  lang,
  onClose,
  onUpdateDb,
}: CandidateDrawerProps) {
  const t = UI_TEXT[lang];
  const candidate = db.candidates.find((c) => c.id === application.candidateId)!;
  const vacancy = db.vacancies.find((v) => v.id === application.vacancyId)!;
  const trackConfig = TRACK_CONFIGS[application.track];
  const matchedProfile = db.positionProfiles.find(
    (p) =>
      p.track === application.track &&
      p.positionName.toLowerCase() === vacancy.position.toLowerCase()
  );
  const criteria =
    matchedProfile && matchedProfile.criteria.length > 0
      ? matchedProfile.criteria
      : EVALUATION_CRITERIA_BY_TRACK[application.track] || [];

  const previousApps = db.applications.filter(
    (a) => a.candidateId === candidate.id && a.id !== application.id
  );
  const appEvaluations = db.evaluations.filter((e) => e.applicationId === application.id);
  const appDocs = db.documents.filter((d) => d.applicationId === application.id);
  const appLogs = db.auditLogs.filter((l) => l.entityId === application.id);
  const hasPassport = appDocs.some((d) => d.docType === "pasport_id" && d.verified);

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    criteria.forEach((c) => (init[c.uz] = 4));
    return init;
  });
  const [evalComment, setEvalComment] = useState("");
  const [hireStartDate, setHireStartDate] = useState(
    application.hireStartDate || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  );
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState(application.vacancyId);
  const initialShift =
    candidate.questionnaireData?.shift ||
    vacancy.shift ||
    "To'liq kun (5/2)";
  const [selectedShift, setSelectedShift] = useState(initialShift);
  const [stageConfirm, setStageConfirm] = useState<{
    targetStage: string;
    message: string;
  } | null>(null);
  const isAutopilot = ["test_kuni", "offer", "hujjat_lms"].includes(application.currentStage);
  const availableShifts =
    db.settings.shifts && db.settings.shifts.length > 0
      ? db.settings.shifts
      : ["1-smena (09:00–18:00)", "2-smena (14:00–23:00)", "2/2 smena", "To'liq kun (5/2)"];

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const openStageConfirm = (targetStage: string) => {
    let defaultMsg = "";
    if (targetStage === "test_kuni") {
      defaultMsg =
        `🎉 Tabriklaymiz, ${candidate.fullName}!\n\n` +
        `Siz ${vacancy.branch} filialidagi ${vacancy.position} lavozimi bo'yicha 1 kunlik sinov kuniga taklif qilindingiz!\n` +
        `🕒 Smena: ${initialShift}\n\n` +
        `⏰ Muhim eslatma: Sinov kuni biriktirilgan smenangizdan (${initialShift}) 15 daqiqa oldin do'kon hududida bo'lishingiz shart!\n\n` +
        `📅 Iltimos, sinov kuniga chiqish uchun o'zingizga qulay sanani tanlang:`;
    } else {
      const tpl = db.messageTemplates.find(
        (m) => m.track === application.track && m.stage === targetStage && m.enabled
      );
      if (tpl) {
        const raw = lang === "ru" ? tpl.templateRu : tpl.templateUz;
        defaultMsg = raw
          .replaceAll("{ism}", candidate.fullName)
          .replaceAll("{lavozim}", vacancy.position)
          .replaceAll("{filial}", vacancy.branch)
          .replaceAll("{maosh}", vacancy.salaryBand)
          .replaceAll("{smena}", initialShift);
      } else {
        defaultMsg =
          lang === "ru"
            ? `Здравствуйте, ${candidate.fullName}! Вы перешли на этап «${getStageLabel(application.track, targetStage, lang)}» по вакансии ${vacancy.position} (${vacancy.branch}).`
            : `Assalomu alaykum, ${candidate.fullName}! Siz ${vacancy.branch} filialidagi ${vacancy.position} lavozimi bo'yicha «${getStageLabel(application.track, targetStage, lang)}» bosqichiga o'tdingiz.`;
      }
    }
    setStageConfirm({ targetStage, message: defaultMsg });
  };

  const handleMoveStage = async (targetStage: string, customMessage?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_stage",
          applicationId: application.id,
          targetStage,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          lang,
          customMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error);
      } else {
        setStageConfirm(null);
        onUpdateDb(data.db);
        showToast("ok", getStageLabel(application.track, targetStage, lang));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalComment.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_evaluation",
          applicationId: application.id,
          evaluatorId: currentUser.id,
          evaluatorName: currentUser.fullName,
          evaluatorRole: currentUser.position,
          stage: application.currentStage,
          scores: criteria.map((c) => ({
            criterion: lang === "ru" ? c.ru : c.uz,
            score: scores[c.uz] || 4,
          })),
          comment: evalComment,
          decision: "pass",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdateDb(data.db);
        setEvalComment("");
        showToast("ok", t.saveEvaluation);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUploadPassport = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_document",
          applicationId: application.id,
          docType: "pasport_id",
          fileName: `pasport_${candidate.fullName.split(" ")[0].toLowerCase()}.jpg`,
          actorName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (res.ok) onUpdateDb(data.db);
    } finally {
      setBusy(false);
    }
  };

  const handleTransferLms = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer_lms",
          applicationId: application.id,
          hireStartDate,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) showToast("err", data.error);
      else {
        onUpdateDb(data.db);
        showToast("ok", t.alreadyHired);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt(
      lang === "ru" ? "Причина отклонения:" : "Rad etish sababini kiriting:",
      lang === "ru" ? "Не подходит по требованиям" : "Talablarga mos kelmadi"
    );
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_application",
          applicationId: application.id,
          reason,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          lang,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdateDb(data.db);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSetStatus = async (status: "reserved" | "blacklist") => {
    let reason = "";
    if (status === "blacklist") {
      const input = window.prompt(
        lang === "ru"
          ? "Причина внесения в черный список:"
          : "Qora ro'yxatga kiritish sababini yozing:",
        ""
      );
      if (input === null) return;
      reason = input.trim();
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_application_status",
          applicationId: application.id,
          status,
          reason,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.db) {
        onUpdateDb(data.db);
        showToast(
          "ok",
          status === "blacklist"
            ? lang === "ru"
              ? "Добавлен в черный список"
              : "Qora ro'yxatga qo'shildi"
            : lang === "ru"
            ? "Переведено в резерв"
            : "Zaxiraga olindi"
        );
      } else {
        showToast("err", data.error || "Xatolik");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMissedCall = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_missed_call",
          applicationId: application.id,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          lang,
        }),
      });
      const data = await res.json();
      if (res.ok && data.db) {
        onUpdateDb(data.db);
        showToast(
          "ok",
          lang === "ru"
            ? "Сообщение отправлено в Telegram"
            : "Telefonni ko'tarmaganligi haqida Telegram xabar yuborildi"
        );
      } else {
        showToast("err", data.error || "Xatolik");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleChangeVacancy = async () => {
    if (isAutopilot) return;
    if (selectedVacancyId === application.vacancyId && selectedShift === initialShift) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_vacancy",
          applicationId: application.id,
          newVacancyId: selectedVacancyId,
          newShift: selectedShift,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.db) {
        onUpdateDb(data.db);
        showToast(
          "ok",
          lang === "ru" ? "Вакансия изменена" : "Vakansiya muvaffaqiyatli o'zgartirildi"
        );
      } else {
        showToast("err", data.error || "Xatolik");
      }
    } finally {
      setBusy(false);
    }
  };

  const currentIdx = trackConfig.stages.findIndex((s) => s.id === application.currentStage);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
    >
      <div className="flex h-full w-full max-w-4xl flex-col bg-[#f6f5f1] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {candidate.avatarUrl ? (
              <img
                src={candidate.avatarUrl}
                alt={candidate.fullName}
                className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-bold text-blue-600">
                {candidate.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {getTrackTitle(application.track, lang)}
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  {application.matchScore}% {t.matchLabel}
                </span>
                {application.status === "reserved" && (
                  <span className="rounded-lg bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    {t.statusReserved}
                  </span>
                )}
                {application.status === "blacklist" && (
                  <span className="rounded-lg bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                    {t.statusBlacklist}
                  </span>
                )}
              </div>
              <h2 className="mt-1 truncate text-lg font-bold text-slate-900">
                {candidate.fullName}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {application.status === "active" && !isAutopilot && (
              <button
                onClick={handleMissedCall}
                disabled={busy}
                className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Phone className="h-3.5 w-3.5" />
                {lang === "ru" ? "Не ответил" : "Ko'tarmadi"}
              </button>
            )}
            {application.status !== "reserved" && application.status !== "hired" && application.status !== "blacklist" && (
              <button
                onClick={() => handleSetStatus("reserved")}
                disabled={busy}
                className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                <Bookmark className="h-3.5 w-3.5" />
                {lang === "ru" ? "В резерв" : "Zaxiraga olish"}
              </button>
            )}
            {currentUser.role === "admin" && application.status !== "blacklist" && (
              <button
                onClick={() => handleSetStatus("blacklist")}
                disabled={busy}
                className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Ban className="h-3.5 w-3.5" />
                {lang === "ru" ? "Черный список" : "Qora ro'yxat"}
              </button>
            )}
            {application.status !== "rejected" && application.status !== "hired" && application.status !== "blacklist" && (
              <button
                onClick={handleReject}
                disabled={busy}
                className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
              >
                <XCircle className="h-3.5 w-3.5" />
                {t.rejectCandidate}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {toast && (
          <div
            className={`mx-6 mt-3 rounded-xl px-4 py-2 text-xs font-semibold text-white ${
              toast.type === "ok" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Simple Stage Stepper */}
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          {(() => {
            const isAutopilot = ["test_kuni", "offer", "hujjat_lms"].includes(
              application.currentStage
            );
            return (
              <>
                <div className="flex w-full gap-1 overflow-x-auto pb-1">
                  {trackConfig.stages.map((st, idx) => {
                    const isPassed = idx <= currentIdx;
                    const canClick = !isAutopilot && idx === currentIdx + 1;
                    return (
                      <button
                        key={st.id}
                        disabled={busy || !canClick}
                        onClick={() => canClick && openStageConfirm(st.id)}
                        title={
                          isAutopilot
                            ? "Bot avtopilotida"
                            : canClick
                            ? "Keyingi bosqichga o'tkazish"
                            : "Faqat navbatdagi bosqichga o'tish mumkin"
                        }
                        style={{
                          backgroundColor: isPassed ? st.color : "#e2e8f0",
                          color: isPassed ? "#ffffff" : "#475569",
                        }}
                        className={`chevron-step flex min-w-[115px] flex-1 items-center justify-center px-3 py-2 text-xs font-semibold transition ${
                          canClick ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-80"
                        }`}
                      >
                        <span className="truncate">{lang === "ru" ? st.shortRu : st.shortUz}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  {isAutopilot
                    ? lang === "ru"
                      ? "🤖 Кандидат на автопилоте Telegram-бота — этапы переключаются автоматически."
                      : "🤖 Nomzod Telegram bot avtopilotida — bosqichlar avtomatik boshqariladi (rekruter o'zgartira olmaydi)."
                    : t.autoBotHint}
                </p>
              </>
            );
          })()}
        </div>

        {/* Clean 2-Column Body */}
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-6 md:grid-cols-12">
          {/* Left: Info + Evaluation + Document */}
          <div className="space-y-4 md:col-span-7">
            {(application.isDuplicateWarning || previousApps.length > 0) && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">{t.duplicateBadge}</p>
                  <p className="mt-0.5 text-[11px]">
                    {candidate.phone} ({previousApps.length})
                  </p>
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.candidateInfo}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400">{t.phoneLabel}</p>
                    <p className="font-semibold text-slate-900">{candidate.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400">{t.addressLabel}</p>
                    <p className="font-semibold text-slate-900">
                      {candidate.address || "—"}
                    </p>
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold text-slate-500">
                    {lang === "ru"
                      ? "Вакансия / Филиал / Смена (до автопилота)"
                      : "Vakansiya / Filial / Smena (avtopilotgacha o'zgartirish mumkin)"}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      disabled={isAutopilot}
                      value={selectedVacancyId}
                      onChange={(e) => setSelectedVacancyId(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {db.vacancies
                        .filter((v) => v.status === "open" || v.status === "accepted" || v.id === application.vacancyId)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.position} — {v.branch}
                          </option>
                        ))}
                    </select>
                    <select
                      disabled={isAutopilot}
                      value={selectedShift}
                      onChange={(e) => setSelectedShift(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {!availableShifts.includes(selectedShift) && (
                        <option value={selectedShift}>{selectedShift}</option>
                      )}
                      {availableShifts.map((sh) => (
                        <option key={sh} value={sh}>
                          {sh}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!isAutopilot &&
                    (selectedVacancyId !== application.vacancyId || selectedShift !== initialShift) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleChangeVacancy}
                        className="mt-2 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        {lang === "ru" ? "Сохранить изменения" : "O'zgarishlarni saqlash"}
                      </button>
                    )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">{t.branchLabel}</p>
                  <p className="font-semibold text-slate-900">{vacancy.branch}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">{t.experienceLabel}</p>
                  <p className="font-semibold text-slate-900">
                    {candidate.experienceYears || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">{t.salaryLabel}</p>
                  <p className="font-semibold text-emerald-700">{vacancy.salaryBand}</p>
                </div>
              </div>
            </div>

            {/* Anketa javoblari (Rasmdagi jadval ko'rinishida) */}
            {candidate.questionnaireData &&
              Object.keys(candidate.questionnaireData).length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {lang === "ru" ? "Вопросник кандидата" : "Nomzod anketasi javoblari"}
                  </h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    {[
                      ["Hudud / Viloyat", candidate.questionnaireData.region],
                      ["Shahar", candidate.questionnaireData.city],
                      ["Filial", candidate.questionnaireData.branch],
                      ["Lavozim", candidate.questionnaireData.position],
                      ["Smena", candidate.questionnaireData.shift],
                      ["Lavozimda tajriba", candidate.questionnaireData.hasExp],
                      ["Ism", candidate.questionnaireData.firstName],
                      ["Familiya", candidate.questionnaireData.lastName],
                      ["Tug'ilgan sana", candidate.questionnaireData.birthDate],
                      ["Yashash manzili", candidate.questionnaireData.address],
                      ["Telefon", candidate.questionnaireData.phone || candidate.phone],
                      ["Jinsi", candidate.questionnaireData.gender],
                      ["Oilaviy holati", candidate.questionnaireData.marital],
                      ["Homiladorlik", candidate.questionnaireData.pregnant],
                      ["Talabami?", candidate.questionnaireData.student],
                      ["Ma'lumot darajasi", candidate.questionnaireData.education],
                      ["O'zbek tili", candidate.questionnaireData.uzLang],
                      ["Rus tili", candidate.questionnaireData.ruLang],
                      ["Umumiy tajriba", candidate.questionnaireData.totalExp],
                      ["Oxirgi ish joyi", candidate.questionnaireData.lastWork],
                      ["Og'ir kasallik / cheklov", candidate.questionnaireData.illness],
                    ]
                      .filter(([, val]) => Boolean(val))
                      .map(([label, val]) => (
                        <div key={label} className="grid grid-cols-2 py-1.5">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-semibold text-slate-900">{val}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Simple Evaluation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.evaluationTitle}
              </h3>
              <form onSubmit={handleSaveEvaluation} className="space-y-2.5">
                {criteria.map((c) => (
                  <div key={c.uz} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700">{lang === "ru" ? c.ru : c.uz}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setScores((p) => ({ ...p, [c.uz]: n }))}
                          className={`h-6 w-6 rounded-md text-xs font-bold ${
                            (scores[c.uz] || 0) >= n
                              ? "bg-amber-400 text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <textarea
                  rows={2}
                  required
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  placeholder={t.commentPlaceholder}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {t.saveEvaluation}
                </button>
              </form>

              {appEvaluations.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {appEvaluations.map((ev) => (
                    <div key={ev.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{ev.evaluatorName}</span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {ev.averageScore}/5
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">{ev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {appDocs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t.documentTitle}
                </h3>
                <div className="space-y-2 text-xs">
                  {appDocs.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {doc.fileName}
                      </span>
                      <span className="text-[10px] text-emerald-600">Ko&apos;rish ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Clean History */}
          <div className="md:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.historyTitle}
              </h3>
              <div className="space-y-3">
                {appLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">{t.noHistory}</p>
                ) : (
                  appLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-blue-200 pl-3 text-xs">
                      <p className="text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString()} • {log.actorName}
                      </p>
                      <p className="font-medium text-slate-800">{log.action}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {stageConfirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setStageConfirm(null);
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === "ru"
                    ? "Проверить / изменить сообщение перед отправкой"
                    : "Bosqichga o'tkazish xabarini tahrirlash"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {getStageLabel(application.track, stageConfirm.targetStage, lang)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStageConfirm(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={7}
              value={stageConfirm.message}
              onChange={(e) =>
                setStageConfirm({ ...stageConfirm, message: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStageConfirm(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
              >
                {lang === "ru" ? "Отмена" : "Bekor qilish"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  handleMoveStage(stageConfirm.targetStage, stageConfirm.message)
                }
                className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy
                  ? "..."
                  : lang === "ru"
                  ? "Подтвердить и отправить"
                  : "Tasdiqlash va yuborish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
