import { getSupabase } from "@/lib/supabase-db";
import { sendTelegramMessage } from "@/lib/telegram";

export const DEFAULT_MANAGER_CODES: Record<string, string> = {
  mgr_aura1: "Aura-1",
  mgr_aura2: "Aura-2",
  mgr_aura3: "Aura-3",
  mgr_aura4: "Aura-4",
  mgr_ofis: "Bosh ofis",
};

interface ManagerBinding {
  branch: string;
  name: string;
  code: string;
}

interface PendingEval {
  appId: string;
  score: number;
}

async function tgRaw(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getManagerSettings() {
  const sb = getSupabase();
  const { data: setRow } = await sb
    .from("ats_settings")
    .select("data")
    .eq("id", "default")
    .maybeSingle();
  const data = (setRow?.data || {}) as Record<string, unknown>;
  const managerBindings = (data.managerBindings || {}) as Record<string, ManagerBinding>;
  const managerCodes = {
    ...DEFAULT_MANAGER_CODES,
    ...((data.managerCodes || {}) as Record<string, string>),
  };
  const managerPendingEvals = (data.managerPendingEvals || {}) as Record<string, PendingEval>;
  return { data, managerBindings, managerCodes, managerPendingEvals };
}

async function saveManagerSettingsPatch(patch: Record<string, unknown>) {
  const sb = getSupabase();
  const { data } = await getManagerSettings();
  const next = { ...data, ...patch };
  await sb.from("ats_settings").upsert({ id: "default", data: next }, { onConflict: "id" });
}

function extractTelegramFileId(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  const m = avatarUrl.match(/file_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function sendManagerCandidateCard(
  token: string,
  targetChatId: string,
  appId: string
): Promise<boolean> {
  const sb = getSupabase();
  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();
  if (!app) return false;

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

  if (!cand) return false;
  const qd = (cand.questionnaire_data || {}) as Record<string, string>;
  const att = qd.interviewAttendance;
  const attLabel =
    att === "arrived"
      ? "🟢 Suhbatga KELDI"
      : att === "no_show"
      ? "🔴 Suhbatga KELMADI"
      : "⏳ Kelishi kutilmoqda";

  const caption =
    `👤 <b>${cand.full_name}</b>\n` +
    `🏢 <b>Filial:</b> ${vac?.branch || qd.branch || "—"} | 💼 <b>${vac?.position || qd.position || "—"}</b>\n` +
    `📱 <b>Telefon:</b> ${cand.phone || "—"}\n` +
    `🎂 <b>Tug'ilgan sana:</b> ${cand.birth_date || qd.birthDate || "—"} (${cand.gender || qd.gender || "—"})\n` +
    `🏠 <b>Manzil:</b> ${cand.address || qd.address || "—"}\n` +
    `🕒 <b>Smena:</b> ${qd.shift || vac?.shift || "—"}\n` +
    `⏳ <b>Tajriba:</b> ${cand.experience_years || qd.totalExp || "—"} | 🎓 ${cand.education || qd.education || "—"}\n` +
    `🏭 <b>Oxirgi ish joyi:</b> ${cand.last_workplace || qd.lastWork || "—"}\n` +
    `🗣 <b>Tillar:</b> O'zb: ${qd.uzLang || "—"} / Rus: ${qd.ruLang || "—"}\n\n` +
    `📌 <b>Holat:</b> ${attLabel}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Suhbatga keldi", callback_data: `mgr:arrived:${app.id}` },
        { text: "❌ Kelmadi", callback_data: `mgr:noshow:${app.id}` },
      ],
      [{ text: "⭐ Baholash (1–5 ball)", callback_data: `mgr:eval:${app.id}` }],
    ],
  };

  const fileId = extractTelegramFileId(cand.avatar_url);
  if (fileId) {
    const res = await tgRaw(token, "sendPhoto", {
      chat_id: targetChatId,
      photo: fileId,
      caption,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
    if (res?.ok) return true;
  }

  await sendTelegramMessage(targetChatId, caption, replyMarkup);
  return true;
}

export async function notifyBranchManagerOnInterview(branch: string, appId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !branch) return;
  const { managerBindings } = await getManagerSettings();
  const targetLower = branch.trim().toLowerCase();

  for (const [chatId, binding] of Object.entries(managerBindings)) {
    if (binding.branch.trim().toLowerCase() === targetLower) {
      await sendManagerCandidateCard(token, chatId, appId);
    }
  }
}

async function saveManagerEvaluation(params: {
  appId: string;
  score: number;
  comment: string;
  managerName: string;
  branch: string;
}) {
  const sb = getSupabase();
  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", params.appId)
    .maybeSingle();
  if (!app) return false;

  const { data: cand } = await sb
    .from("ats_candidates")
    .select("id, full_name, questionnaire_data")
    .eq("id", app.candidate_id)
    .maybeSingle();

  await sb.from("ats_evaluations").insert({
    id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    application_id: params.appId,
    evaluator_id: `mgr-${params.branch.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    evaluator_name: `${params.managerName} (${params.branch} menejeri)`,
    evaluator_role: "manager",
    stage: "rahbar_suhbati",
    scores: [{ criterion: "Rahbar suhbati bahosi (Bot)", score: params.score }],
    average_score: params.score,
    comment: params.comment || "Telegram bot orqali baholandi",
    decision: params.score >= 4 ? "pass" : "fail",
  });

  await sb
    .from("ats_applications")
    .update({ match_score: Math.min(100, Math.max(20, params.score * 20)) })
    .eq("id", params.appId);

  if (cand) {
    const prevQd = (cand.questionnaire_data || {}) as Record<string, unknown>;
    if (!prevQd.interviewAttendance) {
      await sb
        .from("ats_candidates")
        .update({
          questionnaire_data: {
            ...prevQd,
            interviewAttendance: "arrived",
            interviewAttendanceAt: new Date().toISOString(),
            interviewAttendanceBy: params.managerName,
          },
        })
        .eq("id", cand.id);
    }
  }

  await sb.from("ats_audit_logs").insert({
    id: `log-${Date.now()}-mgr`,
    entity_type: "application",
    entity_id: params.appId,
    actor_id: "manager_bot",
    actor_name: `${params.managerName} (${params.branch})`,
    action: `Menejer baholadi (${params.score}/5)`,
    new_value: params.comment || `${params.score} ball`,
  });

  await sb.from("ats_notifications").insert({
    id: `notif-${Date.now()}-mgr`,
    title: `Menejer baholadi (${params.branch})`,
    message: `${cand?.full_name || "Nomzod"} — ${params.score}/5 ball. ${params.comment ? `Izoh: ${params.comment}` : ""}`,
    type: params.score >= 4 ? "success" : "warning",
    read: false,
    related_application_id: params.appId,
  });

  return true;
}

export async function handleManagerCommand(
  token: string,
  chatId: number,
  text: string,
  fromName: string
): Promise<boolean> {
  const cid = String(chatId);
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const { managerBindings, managerCodes, managerPendingEvals } = await getManagerSettings();

  // 1. Menejer kirish kodi (masalan: mgr_aura1 yoki /mgr mgr_aura1)
  const codeCandidate = lower.startsWith("/mgr ") ? lower.replace("/mgr ", "").trim() : lower;
  const matchedEntry = Object.entries(managerCodes).find(
    ([code]) => code.toLowerCase() === codeCandidate
  );

  if (matchedEntry) {
    const [code, branch] = matchedEntry;
    const nextBindings = {
      ...managerBindings,
      [cid]: { branch, name: fromName, code },
    };
    await saveManagerSettingsPatch({ managerBindings: nextBindings });

    await tgRaw(token, "sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text:
        `👋 <b>Xush kelibsiz, ${fromName}!</b>\n\n` +
        `Siz <b>${branch}</b> filiali menejeri sifatida ulandingiz.\n` +
        `Endi rekruter nomzodni <b>«Rahbar bilan suhbat»</b> bosqichiga o'tkazishi bilan uning rasmi va to'liq anketasi shu yerga keladi.\n\n` +
        `Hozir suhbatda turgan nomzodlarni ko'rish uchun pastdagi tugmani bosing:`,
      reply_markup: {
        keyboard: [
          [{ text: "👥 Suhbatdagi nomzodlar" }],
          [{ text: "📋 Bo'sh ish o'rinlari" }, { text: "📄 Ariza holati" }],
        ],
        resize_keyboard: true,
      },
    });
    return true;
  }

  // 2. Menejer baholashdan keyin izoh yozayotgan bo'lsa
  if (managerPendingEvals[cid]) {
    const pending = managerPendingEvals[cid];
    const binding = managerBindings[cid];
    const nextPending = { ...managerPendingEvals };
    delete nextPending[cid];
    await saveManagerSettingsPatch({ managerPendingEvals: nextPending });

    await saveManagerEvaluation({
      appId: pending.appId,
      score: pending.score,
      comment: trimmed,
      managerName: binding?.name || fromName,
      branch: binding?.branch || "Filial",
    });

    await sendTelegramMessage(
      cid,
      `✅ <b>Baho (${pending.score}/5 ⭐️) va izohingiz ATS tizimiga saqlandi!</b>`
    );
    return true;
  }

  // 3. Menejer o'z filialidagi "Rahbar bilan suhbat" bosqichidagi nomzodlarni ko'rishi
  if (trimmed === "👥 Suhbatdagi nomzodlar") {
    const binding = managerBindings[cid];
    if (!binding) {
      await sendTelegramMessage(
        cid,
        "🔐 Avval filial menejeri maxsus kodini kiriting (masalan: <code>mgr_aura1</code>)."
      );
      return true;
    }

    const sb = getSupabase();
    const { data: vacs } = await sb
      .from("ats_vacancies")
      .select("id, branch, position")
      .ilike("branch", binding.branch);
    const vacIds = (vacs || []).map((v) => v.id);

    if (vacIds.length === 0) {
      await sendTelegramMessage(
        cid,
        `📭 <b>${binding.branch}</b> filialida hozircha suhbatdagi nomzodlar yo'q.`
      );
      return true;
    }

    const { data: apps } = await sb
      .from("ats_applications")
      .select("id, candidate_id, vacancy_id, current_stage, status")
      .in("vacancy_id", vacIds)
      .eq("current_stage", "rahbar_suhbati")
      .eq("status", "active")
      .order("stage_entered_at", { ascending: false })
      .limit(20);

    if (!apps || apps.length === 0) {
      await sendTelegramMessage(
        cid,
        `📭 <b>${binding.branch}</b> filialida hozircha <b>«Rahbar bilan suhbat»</b> bosqichida nomzodlar yo'q.`
      );
      return true;
    }

    const candIds = apps.map((a) => a.candidate_id);
    const { data: cands } = await sb
      .from("ats_candidates")
      .select("id, full_name, questionnaire_data")
      .in("id", candIds);
    const cMap = new Map((cands || []).map((c) => [c.id, c]));
    const vMap = new Map((vacs || []).map((v) => [v.id, v]));

    const buttons = apps.map((a, idx) => {
      const c = cMap.get(a.candidate_id);
      const v = vMap.get(a.vacancy_id);
      const att = (c?.questionnaire_data as Record<string, string> | undefined)?.interviewAttendance;
      const icon = att === "arrived" ? "🟢" : att === "no_show" ? "🔴" : "⏳";
      return [
        {
          text: `${icon} ${idx + 1}. ${c?.full_name || "Nomzod"} — ${v?.position || ""}`,
          callback_data: `mgr:view:${a.id}`,
        },
      ];
    });

    await sendTelegramMessage(
      cid,
      `👥 <b>${binding.branch} — Suhbatdagi nomzodlar (${apps.length} ta):</b>\nAnketasini ochish va belgilash uchun tanlang:`,
      { inline_keyboard: buttons }
    );
    return true;
  }

  return false;
}

export async function handleManagerCallback(
  token: string,
  chatId: number,
  msgId: number | undefined,
  data: string,
  fromName: string
): Promise<boolean> {
  if (!data.startsWith("mgr:")) return false;
  const cid = String(chatId);
  const { managerBindings, managerPendingEvals } = await getManagerSettings();
  const binding = managerBindings[cid];

  if (!binding) {
    await sendTelegramMessage(cid, "🔐 Bu bo'lim faqat filial menejerlari uchun.");
    return true;
  }

  const sb = getSupabase();

  if (data.startsWith("mgr:view:")) {
    const appId = data.replace("mgr:view:", "");
    await sendManagerCandidateCard(token, cid, appId);
    return true;
  }

  if (data.startsWith("mgr:arrived:") || data.startsWith("mgr:noshow:")) {
    const isArrived = data.startsWith("mgr:arrived:");
    const appId = data.replace(isArrived ? "mgr:arrived:" : "mgr:noshow:", "");

    const { data: app } = await sb
      .from("ats_applications")
      .select("id, candidate_id")
      .eq("id", appId)
      .maybeSingle();
    if (!app) return true;

    const { data: cand } = await sb
      .from("ats_candidates")
      .select("id, full_name, questionnaire_data")
      .eq("id", app.candidate_id)
      .maybeSingle();

    if (cand) {
      const prevQd = (cand.questionnaire_data || {}) as Record<string, unknown>;
      await sb
        .from("ats_candidates")
        .update({
          questionnaire_data: {
            ...prevQd,
            interviewAttendance: isArrived ? "arrived" : "no_show",
            interviewAttendanceAt: new Date().toISOString(),
            interviewAttendanceBy: `${binding.name} (${binding.branch})`,
          },
        })
        .eq("id", cand.id);
    }

    await sb.from("ats_audit_logs").insert({
      id: `log-${Date.now()}-att`,
      entity_type: "application",
      entity_id: appId,
      actor_id: "manager_bot",
      actor_name: `${binding.name} (${binding.branch})`,
      action: isArrived ? "Suhbatga keldi (Menejer)" : "Suhbatga kelmadi (Menejer)",
      new_value: isArrived ? "arrived" : "no_show",
    });

    await sb.from("ats_notifications").insert({
      id: `notif-${Date.now()}-att`,
      title: isArrived
        ? `🟢 Suhbatga keldi (${binding.branch})`
        : `🔴 Suhbatga kelmadi (${binding.branch})`,
      message: `${cand?.full_name || "Nomzod"} — ${binding.name} tomonidan belgilandi.`,
      type: isArrived ? "success" : "warning",
      read: false,
      related_application_id: appId,
    });

    if (isArrived) {
      await sendTelegramMessage(
        cid,
        `🟢 <b>${cand?.full_name || "Nomzod"} — Suhbatga KELDI</b> deb belgilandi (ATS da yashil rangda ko'rinadi).\n\n⭐ Endi suhbat natijasini baholang (1–5 ball):`,
        {
          inline_keyboard: [
            [1, 2, 3, 4, 5].map((n) => ({
              text: `${n} ⭐️`,
              callback_data: `mgr:rate:${appId}:${n}`,
            })),
          ],
        }
      );
    } else {
      await sendTelegramMessage(
        cid,
        `🔴 <b>${cand?.full_name || "Nomzod"} — Suhbatga KELMADI</b> deb belgilandi (ATS da qizil rangda ko'rinadi).`
      );
    }
    return true;
  }

  if (data.startsWith("mgr:eval:")) {
    const appId = data.replace("mgr:eval:", "");
    await sendTelegramMessage(
      cid,
      "⭐ <b>Nomzodni 1 dan 5 gacha baholang:</b>",
      {
        inline_keyboard: [
          [1, 2, 3, 4, 5].map((n) => ({
            text: `${n} ⭐️`,
            callback_data: `mgr:rate:${appId}:${n}`,
          })),
        ],
      }
    );
    return true;
  }

  if (data.startsWith("mgr:rate:")) {
    const parts = data.split(":");
    const appId = parts[2];
    const score = Number(parts[3] || 4);
    await saveManagerSettingsPatch({
      managerPendingEvals: { ...managerPendingEvals, [cid]: { appId, score } },
    });
    await sendTelegramMessage(
      cid,
      `⭐ Tanlangan baho: <b>${score} / 5</b>.\n\n✍️ Nomzod haqida qisqa izoh yozing (yoki pastdagi tugma bilan izohsiz saqlang):`,
      {
        inline_keyboard: [
          [{ text: "✅ Izohsiz saqlash", callback_data: `mgr:save:${appId}:${score}` }],
        ],
      }
    );
    return true;
  }

  if (data.startsWith("mgr:save:")) {
    const parts = data.split(":");
    const appId = parts[2];
    const score = Number(parts[3] || 4);
    const nextPending = { ...managerPendingEvals };
    delete nextPending[cid];
    await saveManagerSettingsPatch({ managerPendingEvals: nextPending });

    await saveManagerEvaluation({
      appId,
      score,
      comment: "",
      managerName: binding.name || fromName,
      branch: binding.branch,
    });

    await sendTelegramMessage(
      cid,
      `✅ <b>Baho (${score}/5 ⭐️) ATS tizimiga muvaffaqiyatli saqlandi!</b>`
    );
    return true;
  }

  return true;
}
