import { getSupabase, notifyApplicantsVacancyClosed } from "@/lib/supabase-db";
import { appendHujjatlarRowToSheets, incrementStaffingFactInSheets } from "@/lib/google-sheets";
import { sendTelegramMessage } from "@/lib/telegram";

const DEFAULT_KDP_CODE = "kdp2026";

async function tgRaw(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getKdpSettings() {
  const sb = getSupabase();
  const { data: setRow } = await sb
    .from("ats_settings")
    .select("data")
    .eq("id", "default")
    .maybeSingle();
  const data = (setRow?.data || {}) as Record<string, unknown>;
  const kdpChatIds: string[] = Array.isArray(data.kdpChatIds)
    ? data.kdpChatIds.map(String)
    : [];
  const kdpAccessCode =
    typeof data.kdpAccessCode === "string" && data.kdpAccessCode.trim()
      ? data.kdpAccessCode.trim()
      : DEFAULT_KDP_CODE;
  const kdpPendingComments = (data.kdpPendingComments || {}) as Record<string, string>;
  return { data, kdpChatIds, kdpAccessCode, kdpPendingComments };
}

async function saveKdpSettingsPatch(patch: Record<string, unknown>) {
  const sb = getSupabase();
  const { data } = await getKdpSettings();
  const next = { ...data, ...patch };
  await sb.from("ats_settings").upsert({ id: "default", data: next }, { onConflict: "id" });
}

function buildFinalWelcomeSms(params: {
  fullName: string;
  tomorrowDisplay: string;
  branch: string;
  position: string;
  toifa: string;
  shift: string;
}) {
  return (
    `🎉 <b>Tabriklaymiz, ${params.fullName}! Hujjatlaringiz rasmiylashtirildi va siz ishga qabul qilindingiz!</b>\n\n` +
    `📅 Ishga chiqish sanangiz: <b>${params.tomorrowDisplay}</b> (ertaga)\n` +
    `🏢 Filial / Do'kon: <b>${params.branch}</b>\n` +
    `💼 Lavozim: <b>${params.position}</b> (${params.toifa})\n` +
    `🕒 Smena: <b>${params.shift}</b> (15 daqiqa oldin kelishni unutmang)\n\n` +
    `Aura jamoasiga xush kelibsiz! 🤝`
  );
}

export async function sendKdpPacket(token: string, targetChatId: string, flowId: string) {
  const sb = getSupabase();
  const { data: flow } = await sb
    .from("ats_onboarding_flows")
    .select("*")
    .eq("id", flowId)
    .maybeSingle();
  if (!flow) return false;

  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", flow.application_id)
    .maybeSingle();
  const { data: cand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("id", flow.candidate_id)
    .maybeSingle();
  const { data: vac } = app
    ? await sb.from("ats_vacancies").select("*").eq("id", app.vacancy_id).maybeSingle()
    : { data: null };

  const qd = (cand?.questionnaire_data || {}) as Record<string, string>;
  const fullName = cand?.full_name || "Nomzod";
  const shortCode = `#KDP-${String(flow.application_id || flow.id).slice(-4).toUpperCase()}`;
  const address = cand?.address || qd.address || "—";
  const birthDate = cand?.birth_date || qd.birthDate || "—";
  const gender = cand?.gender || qd.gender || "—";
  const education = cand?.education || qd.education || "—";
  const experience = cand?.experience_years || qd.totalExp || "—";
  const phone = flow.doc_phone || cand?.phone || "—";
  const branch = vac?.branch || qd.branch || "—";
  const position = vac?.position || qd.position || "—";
  const toifa = qd.toifa || "0-toifa";
  const shift = flow.shift || qd.shift || vac?.shift || "—";
  const salary = vac?.salary_band || "Shtat bo'yicha";

  // 1. Send all 3 photos grouped in ONE single album (sendMediaGroup) so multiple candidates never mix!
  const media: { type: string; media: string; caption?: string; parse_mode?: string }[] = [];
  if (flow.passport_front_file_id) {
    media.push({
      type: "photo",
      media: flow.passport_front_file_id,
      caption: `📎 <b>${shortCode} • ${fullName}</b>\n1) Pasport Oldi  |  2) Pasport Orqasi  |  3) 3x4 Rasm`,
      parse_mode: "HTML",
    });
  }
  if (flow.passport_back_file_id) {
    media.push({ type: "photo", media: flow.passport_back_file_id });
  }
  if (flow.photo_3x4_file_id) {
    media.push({ type: "photo", media: flow.photo_3x4_file_id });
  }

  let albumMsgId: number | undefined;
  if (media.length > 0) {
    const mgRes = await tgRaw(token, "sendMediaGroup", {
      chat_id: targetChatId,
      media,
    });
    if (mgRes?.ok && Array.isArray(mgRes.result) && mgRes.result[0]?.message_id) {
      albumMsgId = mgRes.result[0].message_id;
    }
  }

  const tashkentTomorrow = new Date(Date.now() + 5 * 3600 * 1000 + 86400000);
  const tomorrowIso = tashkentTomorrow.toISOString().slice(0, 10);
  const [ty, tm, td] = tomorrowIso.split("-");
  const tomorrowDisplay = `${td}.${tm}.${ty}`;

  const previewSms = buildFinalWelcomeSms({
    fullName,
    tomorrowDisplay,
    branch,
    position,
    toifa,
    shift,
  });

  const isCompleted = flow.step === "completed";
  const cardText =
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📂 <b>${shortCode} — KDP NOMZOD KARTOCHKASI</b>${isCompleted ? " ✅" : ""}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 <b>F.I.O:</b> ${fullName}\n` +
    `📱 <b>Telefon:</b> ${phone}\n` +
    `🎂 <b>Tug'ilgan sana:</b> ${birthDate} (${gender})\n` +
    `🏠 <b>Aniq manzil:</b> ${address}\n` +
    `🎓 <b>Ma'lumoti:</b> ${education} | <b>Tajriba:</b> ${experience}\n\n` +
    `🏢 <b>Filial / Do'kon:</b> ${branch}\n` +
    `💼 <b>Lavozim:</b> ${position}\n` +
    `🏷 <b>Toifa:</b> ${toifa}\n` +
    `🕒 <b>Smena:</b> ${shift}\n` +
    `💰 <b>Maosh:</b> ${salary}\n` +
    `📅 <b>Sinov sanasi:</b> ${flow.test_date || "—"}\n\n` +
    `✉️ <b>Nomzodga boradigan yakuniy xabar:</b>\n` +
    `<blockquote>${previewSms}</blockquote>`;

  // 2. Reply directly to that candidate's photo album so each candidate stays visually locked together!
  const msgBody: Record<string, unknown> = {
    chat_id: targetChatId,
    text: cardText,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (albumMsgId) {
    msgBody.reply_to_message_id = albumMsgId;
  }
  if (!isCompleted) {
    msgBody.reply_markup = {
      inline_keyboard: [
        [{ text: "✅ Rasmiylashtirildi (Tasdiqlash)", callback_data: `kdp:approve:${flow.id}` }],
        [{ text: "⚠️ Muammo bor (Izoh yuborish)", callback_data: `kdp:reject:${flow.id}` }],
      ],
    };
  }

  await tgRaw(token, "sendMessage", msgBody);
  return true;
}

export async function notifyAllKdpStaff(token: string, flowId: string): Promise<number> {
  const { kdpChatIds } = await getKdpSettings();
  let sent = 0;
  for (const cid of kdpChatIds) {
    const ok = await sendKdpPacket(token, cid, flowId);
    if (ok) sent++;
  }
  return sent;
}

export async function finalizeHireAfterKdp(
  token: string,
  flowId: string,
  actorName: string
): Promise<{ ok: boolean; candidateName?: string; finalSms?: string }> {
  const sb = getSupabase();
  const { data: flow } = await sb
    .from("ats_onboarding_flows")
    .select("*")
    .eq("id", flowId)
    .maybeSingle();
  if (!flow) return { ok: false };

  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", flow.application_id)
    .maybeSingle();
  const { data: cand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("id", flow.candidate_id)
    .maybeSingle();
  const { data: vac } = app
    ? await sb.from("ats_vacancies").select("*").eq("id", app.vacancy_id).maybeSingle()
    : { data: null };

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const tashkentTomorrow = new Date(nowMs + 5 * 3600 * 1000 + 86400000);
  const tomorrowIso = tashkentTomorrow.toISOString().slice(0, 10);
  const [ty, tm, td] = tomorrowIso.split("-");
  const tomorrowDisplay = `${td}.${tm}.${ty}`;

  await sb
    .from("ats_onboarding_flows")
    .update({ step: "completed", updated_at: nowIso })
    .eq("id", flow.id);

  await sb
    .from("ats_applications")
    .update({
      status: "hired",
      current_stage: "ishga_qabul",
      hire_start_date: tomorrowIso,
      lms_transferred_at: nowIso,
    })
    .eq("id", flow.application_id);

  const { data: setRow } = await sb
    .from("ats_settings")
    .select("data")
    .eq("id", "default")
    .maybeSingle();

  if (vac && app) {
    const nextFilled = Math.min(vac.headcount || 1, (vac.filled_count || 0) + 1);
    const isClosed = nextFilled >= (vac.headcount || 1);
    await sb
      .from("ats_vacancies")
      .update({
        filled_count: nextFilled,
        status: isClosed ? "closed" : vac.status,
      })
      .eq("id", vac.id);

    const stRes = await incrementStaffingFactInSheets({
      branch: vac.branch,
      position: vac.position,
      webhookUrl: setRow?.data?.googleSheetsWebhookUrl,
    });
    await sb.from("ats_integration_events").insert({
      id: `evt-${Date.now()}-st`,
      direction: "outbound",
      system: "GoogleSheets",
      event_type: "SHTATKA_FACT_INCREMENT",
      payload_summary: `${vac.branch} — ${vac.position}: ${stRes.ok ? "+1 Band yangilandi" : stRes.error}`,
      status: stRes.ok ? "success" : "failed",
    });

    if (isClosed) {
      await notifyApplicantsVacancyClosed(vac.id, app.id);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rekruting-ats.onrender.com";
  const frontUrl = flow.passport_front_file_id
    ? `${baseUrl}/api/telegram/file?file_id=${encodeURIComponent(flow.passport_front_file_id)}`
    : "";
  const backUrl = flow.passport_back_file_id
    ? `${baseUrl}/api/telegram/file?file_id=${encodeURIComponent(flow.passport_back_file_id)}`
    : "";
  const p3x4Url = flow.photo_3x4_file_id
    ? `${baseUrl}/api/telegram/file?file_id=${encodeURIComponent(flow.photo_3x4_file_id)}`
    : "";
  const surveyArr: { question: string; answer: string }[] = Array.isArray(flow.survey_answers)
    ? flow.survey_answers
    : [];
  const surveySummary = surveyArr.map((s) => `${s.question}: ${s.answer}`).join(" | ");
  const qd = (cand?.questionnaire_data || {}) as Record<string, string>;
  const shift = flow.shift || qd.shift || vac?.shift || "—";
  const toifa = qd.toifa || "0-toifa";

  await appendHujjatlarRowToSheets({
    existingSpreadsheetId: setRow?.data?.googleSpreadsheetId,
    webhookUrl: setRow?.data?.googleSheetsWebhookUrl,
    row: {
      date: nowIso.slice(0, 10),
      fullName: cand?.full_name || "—",
      birthDate: cand?.birth_date || qd.birthDate || "—",
      gender: cand?.gender || qd.gender || "—",
      address: cand?.address || qd.address || "—",
      phone: flow.doc_phone || cand?.phone || "—",
      education: cand?.education || qd.education || "—",
      experience: cand?.experience_years || qd.totalExp || "—",
      branch: vac?.branch || "—",
      position: vac?.position || "—",
      shift,
      salary: vac?.salary_band || "—",
      testDate: flow.test_date || "—",
      passportFrontUrl: frontUrl,
      passportBackUrl: backUrl,
      photo3x4Url: p3x4Url,
      surveySummary,
    },
  });

  await sb.from("ats_notifications").insert({
    id: `notif-${Date.now()}`,
    title: "KDP tasdiqladi — Yangi xodim ishga qabul qilindi!",
    message: `${cand?.full_name || "Nomzod"} (${actorName} tomonidan rasmiylashtirildi). Ishga chiqish sanasi: ${tomorrowDisplay}.`,
    type: "success",
    read: false,
    related_application_id: flow.application_id,
  });

  const finalSms = buildFinalWelcomeSms({
    fullName: cand?.full_name || "",
    tomorrowDisplay,
    branch: vac?.branch || "—",
    position: vac?.position || "—",
    toifa,
    shift,
  });

  await sendTelegramMessage(String(flow.chat_id), finalSms);

  return { ok: true, candidateName: cand?.full_name, finalSms };
}

export async function handleKdpCommand(
  token: string,
  chatId: number,
  text: string,
  fromName: string
): Promise<boolean> {
  const cid = String(chatId);
  const trimmed = text.trim();
  const { kdpChatIds, kdpAccessCode, kdpPendingComments } = await getKdpSettings();

  // 1. KDP kirish kodi: /kdp kdp2026 yoki shunchaki kdp2026
  if (
    trimmed.toLowerCase() === `/kdp ${kdpAccessCode.toLowerCase()}` ||
    trimmed.toLowerCase() === kdpAccessCode.toLowerCase()
  ) {
    const nextIds = Array.from(new Set([...kdpChatIds, cid]));
    await saveKdpSettingsPatch({ kdpChatIds: nextIds });
    await tgRaw(token, "sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text:
        `👋 <b>KDP xodimi ${fromName}, xush kelibsiz!</b>\n\n` +
        `Siz Kadrlar hujjatlashtirish (KDP) bo'limi sifatida tizimga ulandingiz.\n` +
        `Endi har bir nomzodning <b>3 ta rasmi bitta albomda</b>, unga javob (reply) sifatida esa <b>F.I.O, manzil, do'kon, lavozim, toifa, smena va yakuniy tabrik xati</b> alohida tartibda kelib tushadi.\n\n` +
        `Pastdagi tugmalardan foydalaning:`,
      reply_markup: {
        keyboard: [
          [{ text: "📋 KDP: Kutilayotganlar" }, { text: "📁 KDP: Rasmiylashtirilganlar" }],
          [{ text: "📋 Bo'sh ish o'rinlari" }, { text: "📄 Ariza holati" }],
        ],
        resize_keyboard: true,
      },
    });
    return true;
  }

  if (trimmed === "/kdp") {
    await sendTelegramMessage(
      cid,
      "🔐 KDP bo'limiga kirish uchun maxsus kodni yuboring:\nMasalan: <code>/kdp kdp2026</code>"
    );
    return true;
  }

  // 2. KDP xodimi "Muammo bor (Izoh)" bosgan bo'lsa
  if (kdpPendingComments[cid]) {
    const flowId = kdpPendingComments[cid];
    const nextPending = { ...kdpPendingComments };
    delete nextPending[cid];
    await saveKdpSettingsPatch({ kdpPendingComments: nextPending });

    const sb = getSupabase();
    const { data: flow } = await sb
      .from("ats_onboarding_flows")
      .select("*")
      .eq("id", flowId)
      .maybeSingle();

    if (flow) {
      await sb
        .from("ats_onboarding_flows")
        .update({ step: "kdp_revision_needed", updated_at: new Date().toISOString() })
        .eq("id", flow.id);

      await sendTelegramMessage(
        String(flow.chat_id),
        `⚠️ <b>Kadrlar bo'limi (KDP) hujjatlaringiz bo'yicha izoh qoldirdi:</b>\n\n` +
          `💬 <i>«${trimmed}»</i>\n\n` +
          `Iltimos, hujjatlarni qayta yuklash uchun pastdagi tugmani bosing:`,
        {
          inline_keyboard: [
            [{ text: "📸 Hujjatlarni qayta yuborish", callback_data: `onboard:redocs:${flow.id}` }],
          ],
        }
      );

      await sendTelegramMessage(
        cid,
        `✅ Izohingiz nomzodga yuborildi! Qayta yuborganida sizga yana xabar keladi.`
      );
    }
    return true;
  }

  // 3. KDP: Kutilayotganlar yoki Rasmiylashtirilganlar ro'yxati
  if (trimmed === "📋 KDP: Kutilayotganlar" || trimmed === "📁 KDP: Rasmiylashtirilganlar") {
    if (!kdpChatIds.includes(cid)) {
      await sendTelegramMessage(cid, "🔐 Avval KDP kodini kiriting: <code>/kdp kdp2026</code>");
      return true;
    }
    const isArchive = trimmed === "📁 KDP: Rasmiylashtirilganlar";
    const targetStep = isArchive ? "completed" : "awaiting_kdp_approval";

    const sb = getSupabase();
    const { data: list } = await sb
      .from("ats_onboarding_flows")
      .select("id, candidate_id, application_id, updated_at")
      .eq("step", targetStep)
      .order("updated_at", { ascending: false })
      .limit(15);

    if (!list || list.length === 0) {
      await sendTelegramMessage(
        cid,
        isArchive
          ? "📁 Hozircha rasmiylashtirilgan nomzodlar yo'q."
          : "✅ Hozircha rasmiylashtirish kutilayotgan nomzodlar yo'q."
      );
      return true;
    }

    const candIds = list.map((p) => p.candidate_id);
    const appIds = list.map((p) => p.application_id);
    const [{ data: cands }, { data: apps }] = await Promise.all([
      sb.from("ats_candidates").select("id, full_name, phone").in("id", candIds),
      sb.from("ats_applications").select("id, vacancy_id").in("id", appIds),
    ]);
    const vacIds = Array.from(new Set((apps || []).map((a) => a.vacancy_id).filter(Boolean)));
    const { data: vacs } = vacIds.length
      ? await sb.from("ats_vacancies").select("id, branch, position").in("id", vacIds)
      : { data: [] };

    const cMap = new Map((cands || []).map((c) => [c.id, c]));
    const aMap = new Map((apps || []).map((a) => [a.id, a]));
    const vMap = new Map((vacs || []).map((v) => [v.id, v]));

    const buttons = list.map((p, i) => {
      const c = cMap.get(p.candidate_id);
      const a = aMap.get(p.application_id);
      const v = a ? vMap.get(a.vacancy_id) : undefined;
      return [
        {
          text: `${i + 1}. ${c?.full_name || "Nomzod"} — ${v?.branch || ""} • ${v?.position || ""}`,
          callback_data: `kdp:view:${p.id}`,
        },
      ];
    });

    await sendTelegramMessage(
      cid,
      isArchive
        ? `📁 <b>KDP — So'nggi rasmiylashtirilganlar (${list.length} ta):</b>\nHujjatlarini ko'rish uchun tanlang:`
        : `📋 <b>KDP — Tasdiqlash kutilayotganlar (${list.length} ta):</b>\nHar birini alohida ochib tekshiring:`,
      { inline_keyboard: buttons }
    );
    return true;
  }

  return false;
}

export async function handleKdpCallback(
  token: string,
  chatId: number,
  msgId: number | undefined,
  data: string,
  fromName: string
): Promise<boolean> {
  if (!data.startsWith("kdp:")) return false;
  const cid = String(chatId);
  const { kdpChatIds, kdpPendingComments } = await getKdpSettings();

  if (!kdpChatIds.includes(cid)) {
    await sendTelegramMessage(cid, "🔐 Bu amal faqat KDP xodimlari uchun.");
    return true;
  }

  if (data.startsWith("kdp:view:")) {
    const flowId = data.replace("kdp:view:", "");
    await sendKdpPacket(token, cid, flowId);
    return true;
  }

  if (data.startsWith("kdp:approve:")) {
    const flowId = data.replace("kdp:approve:", "");
    const res = await finalizeHireAfterKdp(token, flowId, `KDP (${fromName})`);
    const doneText = res.ok
      ? `✅ <b>Rasmiylashtirildi!</b>\n` +
        `👤 <b>${res.candidateName || "Nomzod"}</b> ishga qabul qilindi va Google Sheets yangilandi.\n` +
        `👮 Tasdiqladi: ${fromName}\n\n` +
        `✉️ <b>Nomzodga yuborilgan yakuniy SMS nusxasi:</b>\n<blockquote>${res.finalSms || ""}</blockquote>`
      : "⚠️ Nomzod topilmadi yoki allaqachon rasmiylashtirilgan.";

    if (msgId) {
      await tgRaw(token, "editMessageText", {
        chat_id: chatId,
        message_id: msgId,
        text: doneText,
        parse_mode: "HTML",
      });
    } else {
      await sendTelegramMessage(cid, doneText);
    }
    return true;
  }

  if (data.startsWith("kdp:reject:")) {
    const flowId = data.replace("kdp:reject:", "");
    await saveKdpSettingsPatch({
      kdpPendingComments: { ...kdpPendingComments, [cid]: flowId },
    });
    await sendTelegramMessage(
      cid,
      "✍️ <b>Nomzodga yuboriladigan izohni yozing</b> (masalan: <i>«Pasport orqasi xira tushgan, qayta yuboring»</i>):"
    );
    return true;
  }

  return true;
}
