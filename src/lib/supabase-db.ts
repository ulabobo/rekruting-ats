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
    sb.from("ats_users").select("id, login, full_name, role, allowed_tracks, position, created_at").order("created_at", { ascending: true }),
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
      fullName: u.full_name,
      role: u.role,
      allowedTracks: u.allowed_tracks || [],
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
      tags: c.tags || [],
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
      criteria: p.criteria || [],
      updatedAt: p.updated_at,
    })),
    erpStaffing: (erpRes.data || []).map((s) => ({
      id: s.id,
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
  address?: string;
  experienceYears?: string;
  education?: string;
  telegramChatId?: string;
  telegramUsername?: string;
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
      address: input.address || null,
      experience_years: input.experienceYears || null,
      education: input.education || null,
      source: input.source,
      is_internal: input.source === "Ichki nomzod",
      telegram_chat_id: input.telegramChatId || null,
      telegram_username: input.telegramUsername || null,
      tags: [input.source],
    });
  } else {
    const { count } = await sb
      .from("ats_applications")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", candidateId);
    isDuplicate = (count || 0) > 0;
    if (input.telegramChatId) {
      await sb
        .from("ats_candidates")
        .update({
          telegram_chat_id: input.telegramChatId,
          telegram_username: input.telegramUsername || null,
        })
        .eq("id", candidateId);
    }
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

export async function notifyReservedCandidatesForCity(params: {
  city: string;
  position: string;
  branch: string;
}) {
  const sb = getSupabase();
  const { data: reserved } = await sb
    .from("ats_candidates")
    .select("*")
    .ilike("city", params.city.trim())
    .not("telegram_chat_id", "is", null);

  if (!reserved || reserved.length === 0) return;

  for (const cand of reserved) {
    const tags = (cand.tags as string[]) || [];
    if (!tags.includes("Zaxira")) continue;
    await sendTelegramMessage(
      cand.telegram_chat_id,
      `🎉 <b>Xushxabar, ${cand.full_name}!</b>\n\n` +
        `Siz kutgan <b>${params.city}</b> shahrida <b>${params.position}</b> (${params.branch}) bo'yicha bo'sh ish o'rni ochildi!\n` +
        `Ariza topshirish uchun /start tugmasini bosing.`
    );
  }
}

export async function createReserveCandidate(input: {
  phone: string;
  fullName: string;
  city: string;
  experienceYears?: string;
  telegramChatId?: string;
  telegramUsername?: string;
}) {
  const sb = getSupabase();
  const phone = normalizePhone(input.phone);
  const { data: existing } = await sb
    .from("ats_candidates")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    await sb
      .from("ats_candidates")
      .update({
        city: input.city,
        telegram_chat_id: input.telegramChatId || null,
        tags: ["Zaxira", input.city],
      })
      .eq("id", existing.id);
  } else {
    await sb.from("ats_candidates").insert({
      id: uid("cand"),
      phone,
      full_name: input.fullName,
      city: input.city,
      address: input.city,
      experience_years: input.experienceYears || null,
      source: "Telegram bot",
      is_internal: false,
      telegram_chat_id: input.telegramChatId || null,
      telegram_username: input.telegramUsername || null,
      tags: ["Zaxira", input.city],
    });
  }

  await sb.from("ats_notifications").insert({
    id: uid("notif"),
    title: `Zaxira anketasi (${input.city})`,
    message: `${input.fullName} (${phone}) — ${input.city} shahrida joy ochilishini kutmoqda.`,
    type: "info",
  });
}

export async function createVacancy(params: {
  track: TrackType;
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
  const id = uid("vac");
  const city = params.city || "Toshkent";
  await sb.from("ats_vacancies").insert({
    id,
    track: params.track,
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
  });

  await logAudit({
    entityType: "vacancy",
    entityId: id,
    actorId: "system",
    actorName: params.actorName,
    action: `Yangi vakansiya ochildi: ${params.position} (${city}, ${params.branch})`,
  });

  await notifyReservedCandidatesForCity({
    city,
    position: params.position,
    branch: params.branch,
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
  fullName: string;
  position: string;
  role: "admin" | "recruiter";
  allowedTracks: TrackType[];
}) {
  const sb = getSupabase();
  const { error } = await sb.from("ats_users").insert({
    id: uid("u"),
    login: params.login.trim(),
    password_hash: params.password,
    full_name: params.fullName,
    position: params.position,
    role: params.role,
    allowed_tracks: params.allowedTracks,
  });
  if (error) throw new Error(error.message);
}

export async function deleteRecruiterUser(userId: string) {
  if (userId === "u-admin") throw new Error("Asosiy adminni o'chirib bo'lmaydi.");
  const sb = getSupabase();
  await sb.from("ats_users").delete().eq("id", userId);
}

export async function savePositionProfile(params: {
  track: TrackType;
  positionName: string;
  criteria: { uz: string; ru: string }[];
}) {
  const sb = getSupabase();
  const id = `prof-${params.track}-${params.positionName}`.toLowerCase().replace(/\s+/g, "-");
  await sb.from("ats_position_profiles").upsert(
    {
      id,
      track: params.track,
      position_name: params.positionName.trim(),
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
  let openedVacancies = 0;

  for (const row of rows) {
    const city = row.city || "Toshkent";
    const id = `erp-${row.branch}-${row.position}`.toLowerCase().replace(/\s+/g, "-");
    await sb.from("ats_erp_staffing").upsert(
      {
        id,
        city,
        branch: row.branch,
        position: row.position,
        track: row.track,
        plan_count: row.planCount,
        fact_count: row.factCount,
        shift: row.shift,
        salary_band: row.salaryBand,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "branch,position" }
    );

    const deficit = row.planCount - row.factCount;
    if (deficit > 0) {
      const { data: existingVac } = await sb
        .from("ats_vacancies")
        .select("id")
        .eq("branch", row.branch)
        .eq("position", row.position)
        .eq("status", "open")
        .maybeSingle();

      if (!existingVac) {
        await createVacancy({
          track: row.track,
          city,
          branch: row.branch,
          position: row.position,
          shift: row.shift,
          salaryBand: row.salaryBand,
          headcount: deficit,
          hiringManagerName: "Sheets ERP Shtat",
          responsibleRecruiterId: "u-admin",
          erpRequestId: `SHEETS-${Date.now().toString().slice(-4)}`,
          actorName: "Google Sheets ERP",
        });

        await sb.from("ats_notifications").insert({
          id: uid("notif"),
          title: "Yangi vakansiya ochildi (Sheets ERP)",
          message: `${row.branch} — ${row.position}: Plan ${row.planCount}, Fakt ${row.factCount}. ${deficit} ta bo'sh o'rin ochildi!`,
          type: "warning",
        });

        openedVacancies++;
      }
    }
  }

  await logIntegration({
    direction: "inbound",
    system: "GoogleSheets",
    eventType: "ERP_STAFFING_CHECK",
    payloadSummary: `${rows.length} ta shtat qatori tekshirildi, ${openedVacancies} ta vakansiya ochildi.`,
    status: "success",
  });

  return { openedVacancies };
}
