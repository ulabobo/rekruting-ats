import { createClient } from "@supabase/supabase-js";
import {
  Application,
  AtsDatabase,
  AuditLog,
  Candidate,
  CandidateSource,
  DocumentType,
  ErpStaffingRow,
  IntegrationEvent,
  Language,
  MassHiringProject,
  MessageTemplate,
  TrackType,
  User,
  Vacancy,
} from "@/types/ats";
import { TRACK_CONFIGS } from "@/lib/stages";
import { sendTelegramMessage } from "@/lib/telegram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function authenticateUser(
  login: string,
  password: string
): Promise<User | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("ats_users")
    .select("*")
    .eq("login", login.trim())
    .eq("password_hash", password)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    login: data.login,
    fullName: data.full_name,
    role: data.role,
    allowedTracks: data.allowed_tracks || [],
    position: data.position,
    createdAt: data.created_at,
  };
}

export async function authenticateByEmail(email: string): Promise<User | null> {
  const sb = getSupabase();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await sb
    .from("ats_users")
    .select("*")
    .or(`email.ilike.${normalized},login.ilike.${normalized}`)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    login: data.login,
    fullName: data.full_name,
    role: data.role,
    allowedTracks: data.allowed_tracks || [],
    position: data.position,
    createdAt: data.created_at,
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("ats_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    login: data.login,
    fullName: data.full_name,
    role: data.role,
    allowedTracks: data.allowed_tracks || [],
    position: data.position,
    createdAt: data.created_at,
  };
}

export async function getFullDatabase(): Promise<AtsDatabase> {
  const sb = getSupabase();

  const [
    usersRes,
    massRes,
    vacRes,
    candRes,
    appRes,
    evalRes,
    docRes,
    logRes,
    tplRes,
    profRes,
    erpRes,
    evtRes,
    notifRes,
    setRes,
  ] = await Promise.all([
    sb.from("ats_users").select("id, login, password_hash, email, full_name, role, allowed_tracks, assigned_branches, position, created_at").order("created_at", { ascending: true }),
    sb.from("ats_mass_projects").select("*").order("created_at", { ascending: false }),
    sb.from("ats_vacancies").select("*").order("approved_at", { ascending: false }),
    sb.from("ats_candidates").select("*").order("created_at", { ascending: false }),
    sb.from("ats_applications").select("*").order("applied_at", { ascending: false }),
    sb.from("ats_evaluations").select("*").order("created_at", { ascending: false }),
    sb.from("ats_documents").select("*").order("uploaded_at", { ascending: false }),
    sb.from("ats_audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("ats_message_templates").select("*").order("track", { ascending: true }),
    sb.from("ats_position_profiles").select("*").order("track", { ascending: true }),
    sb.from("ats_erp_staffing").select("*").order("branch", { ascending: true }),
    sb.from("ats_integration_events").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("ats_notifications").select("*").order("created_at", { ascending: false }).limit(50),
    sb.from("ats_settings").select("*").eq("id", "default").maybeSingle(),
  ]);

  return {
    users: (usersRes.data || []).map((u) => ({
      id: u.id,
      login: u.login,
      password: u.password_hash,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      allowedTracks: u.allowed_tracks || [],
      assignedBranches: u.assigned_branches || [],
      position: u.position,
      createdAt: u.created_at,
    })),
    massProjects: (massRes.data || []).map((m) => ({
      id: m.id,
      storeName: m.store_name,
      address: m.address,
      openingDate: m.opening_date,
      createdBy: m.created_by,
      status: m.status,
      quotas: m.quotas || [],
      createdAt: m.created_at,
    })),
    vacancies: (vacRes.data || []).map((v) => ({
      id: v.id,
      track: v.track,
      region: v.region || "Toshkent shahri",
      city: v.city || "Toshkent",
      branch: v.branch,
      position: v.position,
      shift: v.shift,
      salaryBand: v.salary_band,
      headcount: v.headcount,
      filledCount: v.filled_count,
      approvedAt: v.approved_at,
      slaDays: v.sla_days,
      erpRequestId: v.erp_request_id,
      massProjectId: v.mass_project_id,
      responsibleRecruiterId: v.responsible_recruiter_id,
      hiringManagerName: v.hiring_manager_name,
      status: v.status,
    })),
    candidates: (candRes.data || []).map((c) => ({
      id: c.id,
      phone: c.phone,
      fullName: c.full_name,
      birthDate: c.birth_date,
      gender: c.gender,
      city: c.city,
      address: c.address,
      region: c.region,
      experienceYears: c.experience_years,
      education: c.education,
      lastWorkplace: c.last_workplace,
      expectedSalary: c.expected_salary,
      source: c.source,
      isInternal: c.is_internal,
      internalCategory: c.internal_category,
      telegramChatId: c.telegram_chat_id,
      telegramUsername: c.telegram_username,
      avatarUrl: c.avatar_url,
      tags: c.tags || [],
      questionnaireData: c.questionnaire_data || {},
      createdAt: c.created_at,
    })),
    applications: (appRes.data || []).map((a) => ({
      id: a.id,
      candidateId: a.candidate_id,
      vacancyId: a.vacancy_id,
      track: a.track,
      currentStage: a.current_stage,
      stageEnteredAt: a.stage_entered_at,
      appliedAt: a.applied_at,
      status: a.status,
      matchScore: a.match_score,
      rejectionReason: a.rejection_reason,
      offerSentAt: a.offer_sent_at,
      hireStartDate: a.hire_start_date,
      lmsTransferredAt: a.lms_transferred_at,
      assignedRecruiterId: a.assigned_recruiter_id,
      isDuplicateWarning: a.is_duplicate_warning,
    })),
    evaluations: (evalRes.data || []).map((e) => ({
      id: e.id,
      applicationId: e.application_id,
      evaluatorId: e.evaluator_id,
      evaluatorName: e.evaluator_name,
      evaluatorRole: e.evaluator_role,
      stage: e.stage,
      scores: e.scores || [],
      averageScore: Number(e.average_score),
      comment: e.comment,
      decision: e.decision,
      createdAt: e.created_at,
    })),
    documents: (docRes.data || []).map((d) => ({
      id: d.id,
      applicationId: d.application_id,
      docType: d.doc_type,
      fileName: d.file_name,
      fileUrl: d.file_url,
      verified: d.verified,
      uploadedAt: d.uploaded_at,
    })),
    auditLogs: (logRes.data || []).map((l) => ({
      id: l.id,
      entityType: l.entity_type,
      entityId: l.entity_id,
      actorId: l.actor_id,
      actorName: l.actor_name,
      action: l.action,
      oldValue: l.old_value,
      newValue: l.new_value,
      createdAt: l.created_at,
    })),
    messageTemplates: (tplRes.data || []).map((t) => ({
      id: t.id,
      track: t.track,
      stage: t.stage,
      enabled: t.enabled,
      templateUz: t.template_uz,
      templateRu: t.template_ru,
      updatedAt: t.updated_at,
    })),
    positionProfiles: (profRes.data || []).map((p) => ({
      id: p.id,
      track: p.track,
      positionName: p.position_name,
      expectationUz: p.expectation_uz || "",
      expectationRu: p.expectation_ru || "",
      criteria: p.criteria || [],
      updatedAt: p.updated_at,
    })),
    erpStaffing: (erpRes.data || []).map((s) => ({
      id: s.id,
      sheetTab: s.sheet_tab || "Aura-1",
      region: s.region || "Toshkent shahri",
      city: s.city || "Toshkent",
      branch: s.branch,
      position: s.position,
      track: s.track,
      planCount: s.plan_count,
      factCount: s.fact_count,
      shift: s.shift,
      salaryBand: s.salary_band,
      updatedAt: s.updated_at,
    })),
    integrationEvents: (evtRes.data || []).map((ev) => ({
      id: ev.id,
      direction: ev.direction,
      system: ev.system,
      eventType: ev.event_type,
      payloadSummary: ev.payload_summary,
      status: ev.status,
      createdAt: ev.created_at,
    })),
    notifications: (notifRes.data || []).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      relatedApplicationId: n.related_application_id,
      createdAt: n.created_at,
    })),
    settings: setRes.data?.data || {
      internalCandidateMinCategory: "2-toifa",
      internalCandidateMinTenureMonths: 6,
      internalSelectionDays: 5,
      storeEmployeeSlaDays: 10,
      storeManagerSlaDays: 30,
      officeEmployeeSlaDays: 30,
      offerTimerStoreDays: 2,
      offerTimerOfficeDays: 3,
    },
  };
}

async function logAudit(entry: Omit<AuditLog, "id" | "createdAt">) {
  const sb = getSupabase();
  await sb.from("ats_audit_logs").insert({
    id: uid("log"),
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    old_value: entry.oldValue || null,
    new_value: entry.newValue || null,
  });
}

async function logIntegration(entry: Omit<IntegrationEvent, "id" | "createdAt">) {
  const sb = getSupabase();
  await sb.from("ats_integration_events").insert({
    id: uid("evt"),
    direction: entry.direction,
    system: entry.system,
    event_type: entry.eventType,
    payload_summary: entry.payloadSummary,
    status: entry.status,
  });
}

async function sendStageTemplateToCandidate(params: {
  track: TrackType;
  stage: string;
  candidate: Candidate;
  vacancy: Vacancy;
  lang?: Language;
}) {
  const sb = getSupabase();
  const { data: tpl } = await sb
    .from("ats_message_templates")
    .select("*")
    .eq("track", params.track)
    .eq("stage", params.stage)
    .eq("enabled", true)
    .maybeSingle();

  if (!tpl) return;

  const rawText = params.lang === "ru" ? tpl.template_ru : tpl.template_uz;
  const text = rawText
    .replaceAll("{ism}", params.candidate.fullName)
    .replaceAll("{lavozim}", params.vacancy.position)
    .replaceAll("{filial}", params.vacancy.branch)
    .replaceAll("{maosh}", params.vacancy.salaryBand);

  if (params.candidate.telegramChatId) {
    const res = await sendTelegramMessage(params.candidate.telegramChatId, text);
    await logIntegration({
      direction: "outbound",
      system: "TelegramBot",
      eventType: `AUTO_STAGE_${params.stage.toUpperCase()}`,
      payloadSummary: `${params.candidate.fullName}: ${res.ok ? "Yuborildi" : res.error}`,
      status: res.ok ? "success" : "failed",
    });
  } else {
    await logIntegration({
      direction: "outbound",
      system: "TelegramBot",
      eventType: `AUTO_STAGE_${params.stage.toUpperCase()}`,
      payloadSummary: `${params.candidate.fullName}: Shablon tayyor (Chat ID yo'q)`,
      status: "pending",
    });
  }
}

export async function createApplicationFromLead(input: {
  phone: string;
  fullName: string;
  vacancyId: string;
  source: CandidateSource;
  birthDate?: string;
  gender?: string;
  city?: string;
  address?: string;
  experienceYears?: string;
  education?: string;
  lastWorkplace?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  avatarUrl?: string;
  questionnaireData?: Record<string, string>;
}): Promise<{ isDuplicate: boolean; applicationId: string }> {
  const sb = getSupabase();
  const phone = normalizePhone(input.phone);

  const { data: vac } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("id", input.vacancyId)
    .maybeSingle();

  if (!vac) throw new Error("Faol vakansiya topilmadi.");

  const { data: existingCand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  let candidateId = existingCand?.id as string | undefined;
  let isDuplicate = false;

  if (!candidateId) {
    candidateId = uid("cand");
    await sb.from("ats_candidates").insert({
      id: candidateId,
      phone,
      full_name: input.fullName,
      birth_date: input.birthDate || null,
      gender: input.gender || null,
      city: input.city || vac.city || null,
      address: input.address || null,
      experience_years: input.experienceYears || null,
      education: input.education || null,
      last_workplace: input.lastWorkplace || null,
      source: input.source,
      is_internal: input.source === "Ichki nomzod",
      telegram_chat_id: input.telegramChatId || null,
      telegram_username: input.telegramUsername || null,
      avatar_url: input.avatarUrl || null,
      tags: [input.source],
      questionnaire_data: input.questionnaireData || {},
    });
  } else {
    const { count } = await sb
      .from("ats_applications")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", candidateId);
    isDuplicate = (count || 0) > 0;
    await sb
      .from("ats_candidates")
      .update({
        telegram_chat_id: input.telegramChatId || existingCand.telegram_chat_id,
        telegram_username: input.telegramUsername || existingCand.telegram_username,
        avatar_url: input.avatarUrl || existingCand.avatar_url,
        questionnaire_data: input.questionnaireData || existingCand.questionnaire_data || {},
      })
      .eq("id", candidateId);
  }

  const track = vac.track as TrackType;
  const firstStage = TRACK_CONFIGS[track].stages[0].id;
  const appId = uid("app");

  await sb.from("ats_applications").insert({
    id: appId,
    candidate_id: candidateId,
    vacancy_id: vac.id,
    track,
    current_stage: firstStage,
    status: "active",
    match_score: isDuplicate ? 65 : 80,
    assigned_recruiter_id: vac.responsible_recruiter_id,
    is_duplicate_warning: isDuplicate,
  });

  await logAudit({
    entityType: "application",
    entityId: appId,
    actorId: "system",
    actorName: input.source,
    action: isDuplicate
      ? "Yangi ariza tushdi (QAYTA MUROJAAT)"
      : "Yangi ariza qabul qilindi",
    newValue: firstStage,
  });

  if (isDuplicate) {
    await sb.from("ats_notifications").insert({
      id: uid("notif"),
      title: "Qayta murojaat aniqlandi",
      message: `${input.fullName} (${phone}) avval ham murojaat qilgan.`,
      type: "info",
      related_application_id: appId,
    });
  }

  return { isDuplicate, applicationId: appId };
}

export async function moveApplicationStage(params: {
  applicationId: string;
  targetStage: string;
  actorId: string;
  actorName: string;
  lang?: Language;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", params.applicationId)
    .maybeSingle();

  if (!app) return { ok: false, error: "Ariza topilmadi." };

  const track = app.track as TrackType;
  const cfg = TRACK_CONFIGS[track];
  const currentIdx = cfg.stages.findIndex((s) => s.id === app.current_stage);
  const targetIdx = cfg.stages.findIndex((s) => s.id === params.targetStage);
  const currentStageDef = cfg.stages[currentIdx];

  if (targetIdx === -1) return { ok: false, error: "Noto'g'ri bosqich." };

  if (["test_kuni", "offer", "hujjat_lms"].includes(app.current_stage)) {
    return {
      ok: false,
      error:
        params.lang === "ru"
          ? "Кандидат на автопилоте бота! Ручное изменение этапа запрещено."
          : "Nomzod bot avtopilotida! Bosqichni qo'lda o'zgartirish mumkin emas.",
    };
  }

  if (targetIdx !== currentIdx + 1) {
    return {
      ok: false,
      error:
        params.lang === "ru"
          ? "Можно перевести только на следующий этап по порядку!"
          : "Faqat navbatdagi keyingi bosqichga o'tkazish mumkin (sakrash yoki orqaga qaytarish mumkin emas)!",
    };
  }

  if (targetIdx > currentIdx && currentStageDef?.requiresEvaluation) {
    const { count } = await sb
      .from("ats_evaluations")
      .select("id", { count: "exact", head: true })
      .eq("application_id", app.id)
      .eq("stage", app.current_stage);
    if (!count || count === 0) {
      return {
        ok: false,
        error:
          params.lang === "ru"
            ? "Перед переходом заполните оценку кандидата!"
            : "Keyingi bosqichga o'tkazishdan oldin Baholash oynasini to'ldiring!",
      };
    }
  }

  const updateData: Record<string, unknown> = {
    current_stage: params.targetStage,
    stage_entered_at: new Date().toISOString(),
  };
  if (params.targetStage === "offer") {
    updateData.status = "offered";
    updateData.offer_sent_at = new Date().toISOString();
  }

  await sb.from("ats_applications").update(updateData).eq("id", app.id);

  await logAudit({
    entityType: "application",
    entityId: app.id,
    actorId: params.actorId,
    actorName: params.actorName,
    action: "Bosqich o'zgartirildi",
    oldValue: app.current_stage,
    newValue: params.targetStage,
  });

  // Avtomatik Telegram shablon xabarini yuborish
  const { data: cand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("id", app.candidate_id)
    .maybeSingle();
  const { data: vac } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("id", app.vacancy_id)
    .maybeSingle();

  if (cand && vac) {
    if (params.targetStage === "test_kuni" && cand.telegram_chat_id) {
      const tashkentNow = new Date(Date.now() + 5 * 3600 * 1000);
      const d1 = new Date(tashkentNow.getTime() + 86400000);
      const d2 = new Date(tashkentNow.getTime() + 2 * 86400000);
      const iso1 = d1.toISOString().slice(0, 10);
      const iso2 = d2.toISOString().slice(0, 10);
      const fmt = (iso: string) => {
        const [y, m, d] = iso.split("-");
        return `${d}.${m}.${y}`;
      };
      const shiftVal =
        (cand.questionnaire_data && cand.questionnaire_data.shift) ||
        vac.shift ||
        "To'liq kun (5/2)";

      await sb.from("ats_onboarding_flows").upsert(
        {
          id: `onb-${app.id}`,
          application_id: app.id,
          candidate_id: cand.id,
          chat_id: cand.telegram_chat_id,
          step: "awaiting_test_date",
          shift: shiftVal,
          survey_index: 0,
          survey_answers: [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id" }
      );

      const inviteText =
        `🎉 <b>Tabriklaymiz, ${cand.full_name}!</b>\n\n` +
        `Siz <b>${vac.branch}</b> filialidagi <b>${vac.position}</b> lavozimi bo'yicha <b>1 kunlik sinov kuniga</b> taklif qilindingiz!\n` +
        `🕒 Smena: <b>${shiftVal}</b>\n\n` +
        `📅 Iltimos, sinov kuniga chiqish uchun o'zingizga qulay sanani tanlang:`;

      const tgRes = await sendTelegramMessage(cand.telegram_chat_id, inviteText, {
        inline_keyboard: [
          [{ text: `📅 ${fmt(iso1)} (Ertaga)`, callback_data: `onboard:testdate:${iso1}` }],
          [{ text: `📅 ${fmt(iso2)} (Indinga)`, callback_data: `onboard:testdate:${iso2}` }],
        ],
      });

      await logIntegration({
        direction: "outbound",
        system: "TelegramBot",
        eventType: "AUTO_STAGE_TEST_KUNI_INVITE",
        payloadSummary: `${cand.full_name}: ${tgRes.ok ? "Sinov kuni taklifi yuborildi" : tgRes.error}`,
        status: tgRes.ok ? "success" : "failed",
      });
    } else {
      await sendStageTemplateToCandidate({
        track,
        stage: params.targetStage,
        candidate: {
          id: cand.id,
          phone: cand.phone,
          fullName: cand.full_name,
          source: cand.source,
          isInternal: cand.is_internal,
          telegramChatId: cand.telegram_chat_id,
          tags: cand.tags || [],
          createdAt: cand.created_at,
        },
        vacancy: {
          id: vac.id,
          track: vac.track,
          city: vac.city || "Toshkent",
          branch: vac.branch,
          position: vac.position,
          salaryBand: vac.salary_band,
          headcount: vac.headcount,
          filledCount: vac.filled_count,
          approvedAt: vac.approved_at,
          slaDays: vac.sla_days,
          responsibleRecruiterId: vac.responsible_recruiter_id,
          hiringManagerName: vac.hiring_manager_name,
          status: vac.status,
        },
        lang: params.lang,
      });
    }
  }

  return { ok: true };
}

export async function addEvaluation(params: {
  applicationId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  stage: string;
  scores: { criterion: string; score: number }[];
  comment: string;
  decision: "pass" | "fail" | "offer" | "reject";
}): Promise<void> {
  const sb = getSupabase();
  const avg = params.scores.length
    ? Number(
        (
          params.scores.reduce((s, x) => s + x.score, 0) / params.scores.length
        ).toFixed(1)
      )
    : 0;

  await sb.from("ats_evaluations").insert({
    id: uid("eval"),
    application_id: params.applicationId,
    evaluator_id: params.evaluatorId,
    evaluator_name: params.evaluatorName,
    evaluator_role: params.evaluatorRole,
    stage: params.stage,
    scores: params.scores,
    average_score: avg,
    comment: params.comment,
    decision: params.decision,
  });

  if (avg > 0) {
    await sb
      .from("ats_applications")
      .update({ match_score: Math.min(100, Math.round(avg * 20)) })
      .eq("id", params.applicationId);
  }

  await logAudit({
    entityType: "application",
    entityId: params.applicationId,
    actorId: params.evaluatorId,
    actorName: params.evaluatorName,
    action: `Baholash kiritildi (${avg}/5)`,
    newValue: params.comment,
  });
}

export async function rejectApplication(params: {
  applicationId: string;
  reason: string;
  actorId: string;
  actorName: string;
  lang?: Language;
}): Promise<void> {
  const sb = getSupabase();
  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (!app) return;

  await sb
    .from("ats_applications")
    .update({ status: "rejected", rejection_reason: params.reason })
    .eq("id", params.applicationId);

  await logAudit({
    entityType: "application",
    entityId: params.applicationId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: `Rad etildi: ${params.reason}`,
    oldValue: app.status,
    newValue: "rejected",
  });

  const { data: cand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("id", app.candidate_id)
    .maybeSingle();
  const { data: vac } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("id", app.vacancy_id)
    .maybeSingle();

  if (cand && vac) {
    await sendStageTemplateToCandidate({
      track: app.track as TrackType,
      stage: "rejected",
      candidate: {
        id: cand.id,
        phone: cand.phone,
        fullName: cand.full_name,
        source: cand.source,
        isInternal: cand.is_internal,
        telegramChatId: cand.telegram_chat_id,
        tags: cand.tags || [],
        createdAt: cand.created_at,
      },
      vacancy: {
        id: vac.id,
        track: vac.track,
        city: vac.city || "Toshkent",
        branch: vac.branch,
        position: vac.position,
        salaryBand: vac.salary_band,
        headcount: vac.headcount,
        filledCount: vac.filled_count,
        approvedAt: vac.approved_at,
        slaDays: vac.sla_days,
        responsibleRecruiterId: vac.responsible_recruiter_id,
        hiringManagerName: vac.hiring_manager_name,
        status: vac.status,
      },
      lang: params.lang,
    });
  }
}

export async function addDocument(params: {
  applicationId: string;
  docType: DocumentType;
  fileName: string;
  fileUrl: string;
  actorName: string;
}) {
  const sb = getSupabase();
  await sb.from("ats_documents").insert({
    id: uid("doc"),
    application_id: params.applicationId,
    doc_type: params.docType,
    file_name: params.fileName,
    file_url: params.fileUrl,
    verified: true,
  });

  await logAudit({
    entityType: "application",
    entityId: params.applicationId,
    actorId: "system",
    actorName: params.actorName,
    action: `Hujjat yuklandi: ${params.fileName}`,
  });
}

export async function transferToLms(params: {
  applicationId: string;
  hireStartDate: string;
  actorId: string;
  actorName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  const { count } = await sb
    .from("ats_documents")
    .select("id", { count: "exact", head: true })
    .eq("application_id", params.applicationId)
    .eq("doc_type", "pasport_id")
    .eq("verified", true);

  if (!count || count === 0) {
    return {
      ok: false,
      error: "Pasport yoki ID karta rasmi yuklanmaguncha o'qitishga topshirib bo'lmaydi!",
    };
  }

  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (!app) return { ok: false, error: "Ariza topilmadi." };

  await sb
    .from("ats_applications")
    .update({
      hire_start_date: params.hireStartDate,
      lms_transferred_at: new Date().toISOString(),
      status: "hired",
      current_stage: "hujjat_lms",
    })
    .eq("id", app.id);

  const { data: vac } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("id", app.vacancy_id)
    .maybeSingle();

  if (vac) {
    const nextFilled = Math.min(vac.headcount, (vac.filled_count || 0) + 1);
    await sb
      .from("ats_vacancies")
      .update({
        filled_count: nextFilled,
        status: nextFilled >= vac.headcount ? "closed" : "open",
      })
      .eq("id", vac.id);
  }

  await logAudit({
    entityType: "application",
    entityId: app.id,
    actorId: params.actorId,
    actorName: params.actorName,
    action: `LMS ga topshirildi (Ishga chiqish: ${params.hireStartDate})`,
    newValue: "hired",
  });

  await logIntegration({
    direction: "outbound",
    system: "LMS",
    eventType: "LMS_ONBOARDING_HANDOFF",
    payloadSummary: `Ariza ${app.id} o'qitish tizimiga topshirildi`,
    status: "success",
  });

  return { ok: true };
}

export async function notifyReservedCandidatesGrouped(
  openedList: { city: string; position: string; branch: string }[]
) {
  if (openedList.length === 0) return;
  const sb = getSupabase();

  const byCity = new Map<string, { position: string; branch: string }[]>();
  for (const item of openedList) {
    const key = item.city.trim().toLowerCase();
    const arr = byCity.get(key) || [];
    arr.push({ position: item.position, branch: item.branch });
    byCity.set(key, arr);
  }

  for (const [cityKey, items] of byCity.entries()) {
    const { data: cands } = await sb
      .from("ats_candidates")
      .select("full_name, telegram_chat_id")
      .ilike("city", cityKey)
      .not("telegram_chat_id", "is", null);

    if (!cands || cands.length === 0) continue;

    const listText = items
      .map((x) => `• <b>${x.position}</b> (${x.branch})`)
      .join("\n");

    for (const cand of cands) {
      await sendTelegramMessage(
        cand.telegram_chat_id,
        `🎉 <b>Yangi bo'sh ish o'rinlari ochildi!</b>\n\n` +
          `${listText}\n\n` +
          `Ariza topshirish uchun /start tugmasini bosing.`
      );
    }
  }
}

export async function acceptVacancy(params: {
  vacancyId: string;
  recruiterId: string;
  recruiterName: string;
}) {
  const sb = getSupabase();
  await sb
    .from("ats_vacancies")
    .update({
      status: "accepted",
      responsible_recruiter_id: params.recruiterId,
    })
    .eq("id", params.vacancyId);

  await logAudit({
    entityType: "vacancy",
    entityId: params.vacancyId,
    actorId: params.recruiterId,
    actorName: params.recruiterName,
    action: `Vakansiya qabul qilindi (${params.recruiterName})`,
    oldValue: "open",
    newValue: "accepted",
  });
}

export async function createReserveCandidate(input: {
  phone: string;
  fullName: string;
  region?: string;
  city: string;
  branch?: string;
  position?: string;
  shift?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  experienceYears?: string;
  education?: string;
  lastWorkplace?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  avatarUrl?: string;
  questionnaireData?: Record<string, string>;
}) {
  const sb = getSupabase();
  const phone = normalizePhone(input.phone);
  const { data: existing } = await sb
    .from("ats_candidates")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  let candidateId = existing?.id as string | undefined;

  if (candidateId) {
    await sb
      .from("ats_candidates")
      .update({
        city: input.city,
        address: input.address || input.city,
        birth_date: input.birthDate || null,
        gender: input.gender || null,
        education: input.education || null,
        last_workplace: input.lastWorkplace || null,
        experience_years: input.experienceYears || null,
        telegram_chat_id: input.telegramChatId || null,
        telegram_username: input.telegramUsername || null,
        avatar_url: input.avatarUrl || null,
        tags: [input.city],
        questionnaire_data: input.questionnaireData || {},
      })
      .eq("id", candidateId);
  } else {
    candidateId = uid("cand");
    await sb.from("ats_candidates").insert({
      id: candidateId,
      phone,
      full_name: input.fullName,
      city: input.city,
      address: input.address || input.city,
      birth_date: input.birthDate || null,
      gender: input.gender || null,
      education: input.education || null,
      last_workplace: input.lastWorkplace || null,
      experience_years: input.experienceYears || null,
      source: "Telegram bot",
      is_internal: false,
      telegram_chat_id: input.telegramChatId || null,
      telegram_username: input.telegramUsername || null,
      avatar_url: input.avatarUrl || null,
      tags: [input.city],
      questionnaire_data: input.questionnaireData || {},
    });
  }

  // Qiziqish bildirganlar (otklik) ustuniga tushadi
  const reserveVacId = `vac-city-${input.city.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const { data: existingVac } = await sb
    .from("ats_vacancies")
    .select("id")
    .eq("id", reserveVacId)
    .maybeSingle();

  if (!existingVac) {
    await sb.from("ats_vacancies").insert({
      id: reserveVacId,
      track: "dokon_xodimi",
      region: input.region || input.city,
      city: input.city,
      branch: input.branch || input.city,
      position: input.position || "Umumiy ariza",
      shift: input.shift || "Kelishiladi",
      salary_band: "Shtat bo'yicha",
      headcount: 1,
      filled_count: 0,
      sla_days: 30,
      responsible_recruiter_id: "u-admin",
      hiring_manager_name: "Rekruter",
      status: "open",
    });
  }

  const appId = uid("app");
  await sb.from("ats_applications").insert({
    id: appId,
    candidate_id: candidateId,
    vacancy_id: reserveVacId,
    track: "dokon_xodimi",
    current_stage: "otklik",
    status: "active",
    match_score: 75,
    assigned_recruiter_id: "u-admin",
    is_duplicate_warning: Boolean(existing),
  });

  await logAudit({
    entityType: "application",
    entityId: appId,
    actorId: "system",
    actorName: "Telegram Bot",
    action: `Yangi ariza qabul qilindi (${input.city})`,
    newValue: "otklik",
  });

  await sb.from("ats_notifications").insert({
    id: uid("notif"),
    title: `Yangi nomzod (${input.city})`,
    message: `${input.fullName} (${phone}) — Qiziqish bildirganlar ustuniga tushdi.`,
    type: "info",
    related_application_id: appId,
  });
}

export async function createVacancy(params: {
  id?: string;
  track: TrackType;
  region?: string;
  city?: string;
  branch: string;
  position: string;
  shift?: string;
  salaryBand: string;
  headcount: number;
  hiringManagerName: string;
  responsibleRecruiterId: string;
  erpRequestId?: string;
  massProjectId?: string;
  actorName: string;
}) {
  const sb = getSupabase();
  const id = params.id || uid("vac");
  const city = params.city || "Toshkent";
  await sb.from("ats_vacancies").upsert(
    {
      id,
      track: params.track,
      region: params.region || "Toshkent shahri",
      city,
      branch: params.branch,
      position: params.position,
      shift: params.shift || "To'liq kun",
      salary_band: params.salaryBand,
      headcount: params.headcount,
      filled_count: 0,
      sla_days: TRACK_CONFIGS[params.track].slaDays,
      erp_request_id: params.erpRequestId || null,
      mass_project_id: params.massProjectId || null,
      responsible_recruiter_id: params.responsibleRecruiterId,
      hiring_manager_name: params.hiringManagerName,
      status: "open",
    },
    { onConflict: "id" }
  );

  await logAudit({
    entityType: "vacancy",
    entityId: id,
    actorId: "system",
    actorName: params.actorName,
    action: `Yangi vakansiya ochildi: ${params.position} (${city}, ${params.branch})`,
  });
}

export async function createMassProject(params: {
  storeName: string;
  address: string;
  openingDate: string;
  createdBy: string;
  quotas: { position: string; requiredCount: number; shift?: string }[];
}) {
  const sb = getSupabase();
  const projectId = uid("mp");
  await sb.from("ats_mass_projects").insert({
    id: projectId,
    store_name: params.storeName,
    address: params.address,
    opening_date: params.openingDate,
    created_by: params.createdBy,
    status: "recruiting",
    quotas: params.quotas.map((q) => ({ ...q, hiredCount: 0 })),
  });

  for (const q of params.quotas) {
    await createVacancy({
      track: "ommaviy_yollash",
      branch: params.storeName,
      position: q.position,
      shift: q.shift || "2/2 smena",
      salaryBand: "Shtat bo'yicha",
      headcount: q.requiredCount,
      hiringManagerName: params.createdBy,
      responsibleRecruiterId: "u-admin",
      massProjectId: projectId,
      actorName: params.createdBy,
    });
  }
}

export async function saveMessageTemplate(params: {
  track: TrackType;
  stage: string;
  enabled: boolean;
  templateUz: string;
  templateRu: string;
}) {
  const sb = getSupabase();
  await sb.from("ats_message_templates").upsert(
    {
      id: `tpl-${params.track}-${params.stage}`,
      track: params.track,
      stage: params.stage,
      enabled: params.enabled,
      template_uz: params.templateUz,
      template_ru: params.templateRu,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "track,stage" }
  );
}

export async function createRecruiterUser(params: {
  login: string;
  password: string;
  email?: string;
  fullName: string;
  position: string;
  role: "admin" | "recruiter";
  allowedTracks: TrackType[];
  assignedBranches?: string[];
}) {
  const sb = getSupabase();
  const { error } = await sb.from("ats_users").insert({
    id: uid("u"),
    login: params.login.trim(),
    password_hash: params.password,
    email: params.email?.trim() || null,
    full_name: params.fullName,
    position: params.position,
    role: params.role,
    allowed_tracks: params.allowedTracks,
    assigned_branches: params.assignedBranches || [],
  });
  if (error) throw new Error(error.message);
}

export async function updateRecruiterUser(params: {
  id: string;
  login: string;
  password?: string;
  email?: string;
  fullName: string;
  position: string;
  role: "admin" | "recruiter";
  allowedTracks: TrackType[];
  assignedBranches?: string[];
}) {
  const sb = getSupabase();
  const payload: Record<string, unknown> = {
    login: params.login.trim(),
    email: params.email?.trim() || null,
    full_name: params.fullName,
    position: params.position,
    role: params.role,
    allowed_tracks: params.allowedTracks,
    assigned_branches: params.assignedBranches || [],
  };
  if (params.password && params.password.trim()) {
    payload.password_hash = params.password.trim();
  }
  const { error } = await sb.from("ats_users").update(payload).eq("id", params.id);
  if (error) throw new Error(error.message);
}

export async function setApplicationStatus(params: {
  applicationId: string;
  status: "active" | "reserved" | "blacklist" | "rejected";
  reason?: string;
  actorId: string;
  actorName: string;
}) {
  const sb = getSupabase();
  const { data: app } = await sb
    .from("ats_applications")
    .select("status")
    .eq("id", params.applicationId)
    .maybeSingle();

  await sb
    .from("ats_applications")
    .update({
      status: params.status,
      rejection_reason: params.reason || null,
    })
    .eq("id", params.applicationId);

  const label =
    params.status === "blacklist"
      ? "Qora ro'yxatga kiritildi"
      : params.status === "reserved"
      ? "Zaxiraga (Rezerv) olindi"
      : params.status;

  await logAudit({
    entityType: "application",
    entityId: params.applicationId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: params.reason ? `${label}: ${params.reason}` : label,
    oldValue: app?.status || "",
    newValue: params.status,
  });
}

export async function changeApplicationVacancy(params: {
  applicationId: string;
  newVacancyId: string;
  actorId: string;
  actorName: string;
}) {
  const sb = getSupabase();
  const { data: newVac } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("id", params.newVacancyId)
    .maybeSingle();
  if (!newVac) throw new Error("Yangi vakansiya topilmadi");

  const { data: app } = await sb
    .from("ats_applications")
    .select("vacancy_id")
    .eq("id", params.applicationId)
    .maybeSingle();

  const { data: oldVac } = app?.vacancy_id
    ? await sb.from("ats_vacancies").select("position, branch").eq("id", app.vacancy_id).maybeSingle()
    : { data: null };

  await sb
    .from("ats_applications")
    .update({
      vacancy_id: newVac.id,
      track: newVac.track,
    })
    .eq("id", params.applicationId);

  await logAudit({
    entityType: "application",
    entityId: params.applicationId,
    actorId: params.actorId,
    actorName: params.actorName,
    action: `Lavozim o'zgartirildi: ${oldVac?.position || "?"} (${oldVac?.branch || ""}) → ${newVac.position} (${newVac.branch})`,
  });
}

export async function deleteRecruiterUser(userId: string) {
  if (userId === "u-admin") throw new Error("Asosiy adminni o'chirib bo'lmaydi.");
  const sb = getSupabase();
  await sb.from("ats_users").delete().eq("id", userId);
}

export async function savePositionProfile(params: {
  track: TrackType;
  positionName: string;
  expectationUz?: string;
  expectationRu?: string;
  criteria: { uz: string; ru: string }[];
}) {
  const sb = getSupabase();
  const id = `prof-${params.track}-${params.positionName}`.toLowerCase().replace(/\s+/g, "-");
  await sb.from("ats_position_profiles").upsert(
    {
      id,
      track: params.track,
      position_name: params.positionName.trim(),
      expectation_uz: params.expectationUz || "",
      expectation_ru: params.expectationRu || "",
      criteria: params.criteria,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "track,position_name" }
  );
}

export async function deletePositionProfile(profileId: string) {
  const sb = getSupabase();
  await sb.from("ats_position_profiles").delete().eq("id", profileId);
}

export async function syncErpStaffingRows(
  rows: Omit<ErpStaffingRow, "id" | "updatedAt">[]
): Promise<{ openedVacancies: number }> {
  const sb = getSupabase();
  const nowIso = new Date().toISOString();

  // 1. Barcha shtat qatorlarini 1 ta batch upsert bilan saqlash
  const staffingPayload = rows.map((row) => {
    const city = row.city || "Toshkent";
    const sheetTab = row.sheetTab || "Aura-1";
    const region = row.region || "Toshkent shahri";
    const id = `erp-${sheetTab}-${row.branch}-${row.position}`.toLowerCase().replace(/\s+/g, "-");
    return {
      id,
      sheet_tab: sheetTab,
      region,
      city,
      branch: row.branch,
      position: row.position,
      track: row.track,
      plan_count: row.planCount,
      fact_count: row.factCount,
      shift: row.shift,
      salary_band: row.salaryBand,
      updated_at: nowIso,
    };
  });

  if (staffingPayload.length > 0) {
    await sb.from("ats_erp_staffing").upsert(staffingPayload, { onConflict: "branch,position" });
  }

  // 2. Mavjud barcha vakansiyalarni 1 ta SELECT bilan olish
  const { data: existingAll } = await sb
    .from("ats_vacancies")
    .select("id, branch, position, headcount, status, erp_request_id");

  const existingById = new Map((existingAll || []).map((v) => [v.id, v]));

  const toUpsertVacs: Record<string, unknown>[] = [];
  const toInsertNotifs: Record<string, unknown>[] = [];
  const toCloseIds: string[] = [];
  const newlyOpened: { city: string; position: string; branch: string }[] = [];
  const activeSheetIds = new Set<string>();

  for (const row of rows) {
    const city = row.city || "Toshkent";
    const region = row.region || "Toshkent shahri";
    const detId = `vac-sh-${`${row.branch}-${row.position}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    activeSheetIds.add(detId);

    const deficit = row.planCount - row.factCount;
    const existing = existingById.get(detId);

    if (deficit > 0) {
      if (!existing || existing.status === "closed") {
        toUpsertVacs.push({
          id: detId,
          track: row.track,
          region,
          city,
          branch: row.branch,
          position: row.position,
          shift: row.shift || "To'liq kun",
          salary_band: row.salaryBand,
          headcount: deficit,
          filled_count: 0,
          sla_days: TRACK_CONFIGS[row.track].slaDays,
          erp_request_id: `SHEETS-${detId.slice(-6).toUpperCase()}`,
          responsible_recruiter_id: "u-admin",
          hiring_manager_name: "Sheets ERP",
          status: "open",
        });
        toInsertNotifs.push({
          id: uid("notif"),
          title: "Yangi vakansiya ochildi",
          message: `${row.branch} — ${row.position}: Shtat ${row.planCount}, Band ${row.factCount}. ${deficit} ta bo'sh o'rin ochildi!`,
          type: "warning",
        });
        newlyOpened.push({ city, position: row.position, branch: row.branch });
      } else if (existing.headcount !== deficit) {
        toUpsertVacs.push({
          id: detId,
          track: row.track,
          region,
          city,
          branch: row.branch,
          position: row.position,
          shift: row.shift || "To'liq kun",
          salary_band: row.salaryBand,
          headcount: deficit,
          status: existing.status,
        });
      }
    } else if (existing && existing.status !== "closed") {
      toCloseIds.push(detId);
      toInsertNotifs.push({
        id: uid("notif"),
        title: "Vakansiya yopildi (Shtat to'ldi)",
        message: `${row.branch} — ${row.position} shtati to'lgani uchun vakansiya yopildi.`,
        type: "success",
      });
    }
  }

  // Sheets'dan o'chirilgan eski SHEETS-* vakansiyalarini ham yopish
  for (const v of existingAll || []) {
    if (
      v.status !== "closed" &&
      String(v.erp_request_id || "").startsWith("SHEETS-") &&
      !activeSheetIds.has(v.id)
    ) {
      toCloseIds.push(v.id);
    }
  }

  if (toUpsertVacs.length > 0) {
    await sb.from("ats_vacancies").upsert(toUpsertVacs, { onConflict: "id" });
  }
  if (toCloseIds.length > 0) {
    await sb
      .from("ats_vacancies")
      .update({ status: "closed" })
      .in("id", toCloseIds);
  }
  if (toInsertNotifs.length > 0) {
    await sb.from("ats_notifications").insert(toInsertNotifs);
  }
  if (newlyOpened.length > 0) {
    await notifyReservedCandidatesGrouped(newlyOpened);
  }

  if (newlyOpened.length > 0 || toCloseIds.length > 0) {
    await logIntegration({
      direction: "inbound",
      system: "GoogleSheets",
      eventType: "ERP_STAFFING_CHECK",
      payloadSummary: `${rows.length} qator tekshirildi: +${newlyOpened.length} ochildi, ${toCloseIds.length} yopildi.`,
      status: "success",
    });
  }

  return { openedVacancies: newlyOpened.length };
}
