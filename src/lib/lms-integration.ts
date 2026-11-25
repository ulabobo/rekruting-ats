import { getSupabase } from "@/lib/supabase-db";
import { sendTelegramMessage } from "@/lib/telegram";

export const ATS_LMS_SECRET = process.env.ATS_LMS_SECRET || "aura-ats-lms-2026-secret";
export const LMS_PUBLIC_URL = (
  process.env.LMS_PUBLIC_URL || "https://teachme-lms.onrender.com"
).replace(/\/$/, "");
export const ERP_TELEGRAM_USERNAME = "@OneErpApp";
export const ERP_TELEGRAM_URL = "https://t.me/OneErpApp";

export const HIRED_EMPLOYEE_KEYBOARD = {
  keyboard: [[{ text: "📚 LMS" }, { text: "💼 ERP" }]],
  resize_keyboard: true,
};

export async function syncHiredEmployeeToLms(params: {
  applicationId: string;
  candidateId: string;
  fullName: string;
  phone: string;
  telegramChatId: string;
  department: string;
  position: string;
  category?: string;
  branch?: string;
  hireStartDate: string;
  workType: "office" | "store_warehouse";
  erpLogin?: string;
  erpPassword?: string;
}): Promise<{
  ok: boolean;
  lmsUrl: string;
  login?: string;
  password?: string;
  error?: string;
}> {
  let lmsUrl = LMS_PUBLIC_URL;
  let login: string | undefined;
  let password: string | undefined;
  let error: string | undefined;

  try {
    const res = await fetch(`${LMS_PUBLIC_URL}/api/integrations/ats/hired`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-integration-key": ATS_LMS_SECRET,
      },
      body: JSON.stringify({
        ats_application_id: params.applicationId,
        full_name: params.fullName,
        phone: params.phone,
        telegram_chat_id: params.telegramChatId,
        department: params.department,
        position: params.position,
        category: params.category || "0",
        branch: params.branch || "",
        hire_start_date: params.hireStartDate,
        work_type: params.workType,
        erp_login: params.erpLogin || "",
        erp_password: params.erpPassword || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      lmsUrl = data.lms_url || LMS_PUBLIC_URL;
      login = data.login;
      password = data.password;
    } else {
      error = data.error || `LMS HTTP ${res.status}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "LMS ulanish xatosi";
  }

  // Persist credentials on candidate.questionnaire_data so Bot buttons always show them
  try {
    const sb = getSupabase();
    const { data: cand } = await sb
      .from("ats_candidates")
      .select("id, questionnaire_data")
      .eq("id", params.candidateId)
      .maybeSingle();
    if (cand) {
      const prev = (cand.questionnaire_data as Record<string, string>) || {};
      await sb
        .from("ats_candidates")
        .update({
          questionnaire_data: {
            ...prev,
            lms_url: lmsUrl,
            lms_login: login || prev.lms_login || "",
            lms_password: password || prev.lms_password || "",
            erp_login: params.erpLogin || prev.erp_login || "",
            erp_password: params.erpPassword || prev.erp_password || "",
            work_type: params.workType,
            hire_start_date: params.hireStartDate,
            lms_menu_synced: "1",
          },
        })
        .eq("id", cand.id);
    }
  } catch {}

  return { ok: Boolean(login), lmsUrl, login, password, error };
}

export function buildAttendanceInstruction(workType: "office" | "store_warehouse"): string {
  if (workType === "office") {
    return (
      `🏢 <b>Ishga kelish-ketish qoidasi (Ofis):</b>\n` +
      `Ishga kelish va ketish vaqtingizni har kuni <b>${ERP_TELEGRAM_USERNAME}</b> orqali o'z vaqtida qayd etib (urib) boring!`
    );
  }
  return (
    `🏪 <b>Ishga kelish-ketish qoidasi (Do'kon / Ombor):</b>\n` +
    `Ishga kelish va ketish vaqtingizni har kuni filialdagi <b>FaceID</b> qurilmasi orqali qayd etib boring!`
  );
}

export async function handleHiredEmployeeMenuCommand(
  chatId: number,
  text: string
): Promise<boolean> {
  const trimmed = text.trim();
  const isLmsBtn = trimmed === "📚 LMS";
  const isErpBtn = trimmed === "💼 ERP";
  const isStartOrOldMenu =
    trimmed === "/start" ||
    trimmed === "📋 Bo'sh ish o'rinlari" ||
    trimmed === "📄 Ariza holati";

  if (!isLmsBtn && !isErpBtn && !isStartOrOldMenu) return false;

  const sb = getSupabase();
  const { data: cand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("telegram_chat_id", String(chatId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cand) return false;

  const { data: hiredApp } = await sb
    .from("ats_applications")
    .select("*")
    .eq("candidate_id", cand.id)
    .eq("status", "hired")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Only intercept /start or old applicant buttons if the user is already hired
  if (!hiredApp && isStartOrOldMenu) return false;

  const qd = (cand.questionnaire_data as Record<string, string>) || {};
  const workType: "office" | "store_warehouse" =
    qd.work_type === "office" ? "office" : "store_warehouse";

  if (isStartOrOldMenu && hiredApp) {
    await sendTelegramMessage(
      String(chatId),
      `👋 <b>Xush kelibsiz, ${cand.full_name}!</b>\n\n` +
        `Siz AURA jamoasining a'zosisiz. O'quv platformasi (LMS) va ERP kirish ma'lumotlarini olish uchun pastdagi <b>📚 LMS</b> va <b>💼 ERP</b> tugmalaridan foydalaning:`,
      HIRED_EMPLOYEE_KEYBOARD
    );
    return true;
  }

  if (isLmsBtn) {
    const lmsUrl = qd.lms_url || LMS_PUBLIC_URL;
    const login = qd.lms_login || "— (HR / L&D dan so'rang)";
    const pass = qd.lms_password || "—";
    await sendTelegramMessage(
      String(chatId),
      `📚 <b>AURA TeachMe LMS — O'quv platformasi</b>\n\n` +
        `🔗 Havola: ${lmsUrl}\n` +
        `👤 Login: <code>${login}</code>\n` +
        `🔑 Parol: <code>${pass}</code>\n\n` +
        `📋 <i>Eslatma: Onboarding davomida (1, 7, 15, 30, 60, 90-kun) maxfiy so'rovnomalar ham aynan LMS ichida ochiladi.</i>`,
      HIRED_EMPLOYEE_KEYBOARD
    );
    return true;
  }

  if (isErpBtn) {
    const erpLogin = qd.erp_login || "— (KDP dan aniqlang)";
    const erpPass = qd.erp_password || "—";
    await sendTelegramMessage(
      String(chatId),
      `💼 <b>AURA ERP tizimi</b>\n\n` +
        `🤖 Telegram bot: <b>${ERP_TELEGRAM_USERNAME}</b> (${ERP_TELEGRAM_URL})\n` +
        `👤 Login: <code>${erpLogin}</code>\n` +
        `🔑 Parol: <code>${erpPass}</code>\n\n` +
        buildAttendanceInstruction(workType),
      HIRED_EMPLOYEE_KEYBOARD
    );
    return true;
  }

  return false;
}

/**
 * Automatically syncs previously hired employees (before this update) to LMS
 * and pushes the new 📚 LMS / 💼 ERP keyboard to their Telegram without requiring /start.
 * Strictly runs once per employee (tracked via questionnaire_data.lms_menu_synced = "1").
 */
export async function autoSyncLegacyHiredEmployees(limit = 20): Promise<number> {
  const sb = getSupabase();
  const { data: hiredApps } = await sb
    .from("ats_applications")
    .select("id, candidate_id, vacancy_id, hire_start_date, created_at")
    .eq("status", "hired")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!hiredApps || hiredApps.length === 0) return 0;

  let syncedCount = 0;
  for (const app of hiredApps) {
    if (syncedCount >= limit) break;
    const { data: cand } = await sb
      .from("ats_candidates")
      .select("*")
      .eq("id", app.candidate_id)
      .maybeSingle();
    if (!cand || !cand.telegram_chat_id) continue;

    const qd = (cand.questionnaire_data as Record<string, string>) || {};
    if (qd.lms_menu_synced === "1") continue;

    const { data: vac } = app.vacancy_id
      ? await sb.from("ats_vacancies").select("*").eq("id", app.vacancy_id).maybeSingle()
      : { data: null };

    const workType: "office" | "store_warehouse" =
      vac?.track === "ofis_xodimi" ? "office" : "store_warehouse";
    const hireDate =
      app.hire_start_date ||
      (app.created_at ? String(app.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10));

    const lmsRes = await syncHiredEmployeeToLms({
      applicationId: app.id,
      candidateId: cand.id,
      fullName: cand.full_name || "Xodim",
      phone: cand.phone || "",
      telegramChatId: String(cand.telegram_chat_id),
      department: workType === "office" ? vac?.branch || "Ofis" : "Savdo bo'limi",
      position: vac?.position || "Sotuvchi-konsultant",
      category: qd.toifa || "0",
      branch: vac?.branch || "",
      hireStartDate: hireDate,
      workType,
      erpLogin: qd.erp_login || "",
      erpPassword: qd.erp_password || "",
    });

    await sendTelegramMessage(
      String(cand.telegram_chat_id),
      `🎉 <b>Yangilik, ${cand.full_name}!</b>\n\n` +
        `Endi botda siz uchun <b>📚 LMS</b> (o'quv platformasi) va <b>💼 ERP</b> (${ERP_TELEGRAM_USERNAME}) tugmalari ishga tushdi.\n` +
        (lmsRes.login
          ? `👤 LMS Login: <code>${lmsRes.login}</code>\n🔑 Parol: <code>${lmsRes.password || "—"}</code>\n\n`
          : "\n") +
        buildAttendanceInstruction(workType) +
        `\n\n👇 Istalgan vaqtda pastdagi tugmalardan foydalaning:`,
      HIRED_EMPLOYEE_KEYBOARD
    );

    syncedCount++;
  }

  return syncedCount;
}
