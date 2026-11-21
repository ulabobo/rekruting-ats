import { addDocument, getSupabase, notifyApplicantsVacancyClosed } from "@/lib/supabase-db";
import { appendHujjatlarRowToSheets, incrementStaffingFactInSheets } from "@/lib/google-sheets";
import {
  DEFAULT_ONBOARDING_FOLDERS,
  DEFAULT_SURVEY_ITEMS,
  DEFAULT_WELCOME_BOOK_TEXT,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "@/lib/telegram";
import { OnboardingFolderItem, SurveyQuestionItem } from "@/types/ats";

async function editOrSendSimple(
  token: string,
  chatId: number,
  msgId: number | undefined,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  if (msgId) {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: msgId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    });
    const d = await res.json();
    if (d.ok) return;
  }
  await sendTelegramMessage(String(chatId), text, replyMarkup);
}

export async function handleOnboardingCallback(
  token: string,
  chatId: number,
  msgId: number | undefined,
  data: string
): Promise<boolean> {
  if (!data.startsWith("onboard:")) return false;

  const sb = getSupabase();
  const { data: flow } = await sb
    .from("ats_onboarding_flows")
    .select("*")
    .eq("chat_id", String(chatId))
    .not("step", "in", '("completed","cancelled_timeout")')
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!flow) {
    await editOrSendSimple(token, chatId, msgId, "ℹ️ Ushbu jarayon allaqachon yakunlangan.");
    return true;
  }

  const { data: cand } = await sb
    .from("ats_candidates")
    .select("*")
    .eq("id", flow.candidate_id)
    .maybeSingle();
  const { data: app } = await sb
    .from("ats_applications")
    .select("*")
    .eq("id", flow.application_id)
    .maybeSingle();
  const { data: vac } = app
    ? await sb.from("ats_vacancies").select("*").eq("id", app.vacancy_id).maybeSingle()
    : { data: null };

  // 1. Sinov kuni sanasini tanlash
  if (data.startsWith("onboard:testdate:")) {
    const chosenDate = data.replace("onboard:testdate:", "");
    const [y, m, d] = chosenDate.split("-");
    const formattedDate = `${d}.${m}.${y}`;

    if (cand) {
      const qData = (cand.questionnaire_data as Record<string, string>) || {};
      await sb
        .from("ats_candidates")
        .update({ questionnaire_data: { ...qData, testDate: formattedDate } })
        .eq("id", cand.id);
    }

    const { data: setRow } = await sb
      .from("ats_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();

    const instantTest = Boolean(setRow?.data?.instantTestMode);

    await sb
      .from("ats_onboarding_flows")
      .update({
        test_date: chosenDate,
        step: instantTest ? "in_survey" : "test_date_selected",
        survey_index: 0,
        survey_answers: [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);

    await editOrSendSimple(
      token,
      chatId,
      msgId,
      `✅ <b>Sinov kuni sanasi tasdiqlandi!</b>\n\n` +
        `📅 Sana: <b>${formattedDate}</b>\n` +
        `🏢 Filial: <b>${vac?.branch || "—"}</b>\n` +
        `💼 Lavozim: <b>${vac?.position || "—"}</b>\n` +
        `🕒 Smena: <b>${flow.shift || vac?.shift || "—"}</b>\n\n` +
        (instantTest
          ? `⚡ <i>Tez test rejimi yoqilgan — sinov kuni xabari va so'rovnoma darhol yuborilmoqda!</i>`
          : `Sinov kuni ertalab sizga eslatma xabari yuboramiz. Omad!`)
    );

    if (instantTest) {
      await sendTelegramMessage(
        String(chatId),
        `☀️ <b>Xayrli tong, ${cand?.full_name || ""}!</b>\n\n` +
          `Bugun sizda <b>${vac?.branch || "filial"}</b>da <b>${vac?.position || "lavozim"}</b> bo'yicha <b>sinov kuni</b>. Omad tilaymiz! 💪`
      );
      const customItems = setRow?.data?.testDaySurveyItems as SurveyQuestionItem[] | undefined;
      const surveyItems: SurveyQuestionItem[] =
        customItems && customItems.length > 0 ? customItems : DEFAULT_SURVEY_ITEMS;
      const firstQ = surveyItems[0];
      const ratingMarkup =
        firstQ.type === "rating"
          ? {
              inline_keyboard: [
                [1, 2, 3, 4, 5].map((n) => ({
                  text: `${n} ⭐️`,
                  callback_data: `onboard:rate:0:${n}`,
                })),
              ],
            }
          : undefined;
      await sendTelegramMessage(
        String(chatId),
        `📝 <b>Bugungi sinov kuningiz yakunlandi!</b>\n\nIltimos, sinov kuni haqida kichik so'rovnomadan o'ting:\n\n<b>${firstQ.question}</b>`,
        ratingMarkup
      );
    }
    return true;
  }

  // 1.5 Sinov kuni so'rovnomasi (1-5 ball tugmalari)
  if (data.startsWith("onboard:rate:")) {
    const parts = data.split(":");
    const qIdx = Number(parts[2] || 0);
    const score = parts[3] || "5";

    const { data: setRow } = await sb
      .from("ats_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const customItems = setRow?.data?.testDaySurveyItems as SurveyQuestionItem[] | undefined;
    const surveyItems: SurveyQuestionItem[] =
      customItems && customItems.length > 0 ? customItems : DEFAULT_SURVEY_ITEMS;

    const currentQ = surveyItems[qIdx];
    const prevAnswers: { question: string; answer: string }[] = Array.isArray(flow.survey_answers)
      ? flow.survey_answers
      : [];
    const nextAnswers = [
      ...prevAnswers,
      { question: currentQ?.question || `Savol ${qIdx + 1}`, answer: `${score} ball` },
    ];

    await editOrSendSimple(
      token,
      chatId,
      msgId,
      `${currentQ?.question || ""}\n\n✅ Tanlangan baho: <b>${score} ⭐️</b>`
    );

    if (qIdx + 1 < surveyItems.length) {
      const nextQ = surveyItems[qIdx + 1];
      await sb
        .from("ats_onboarding_flows")
        .update({
          survey_index: qIdx + 1,
          survey_answers: nextAnswers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flow.id);

      const ratingMarkup =
        nextQ.type === "rating"
          ? {
              inline_keyboard: [
                [1, 2, 3, 4, 5].map((n) => ({
                  text: `${n} ⭐️`,
                  callback_data: `onboard:rate:${qIdx + 1}:${n}`,
                })),
              ],
            }
          : undefined;
      await sendTelegramMessage(String(chatId), `<b>${nextQ.question}</b>`, ratingMarkup);
    } else {
      await sb
        .from("ats_onboarding_flows")
        .update({
          step: "awaiting_test_satisfaction",
          survey_answers: nextAnswers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flow.id);
      await sendTelegramMessage(
        String(chatId),
        `✅ So'rovnoma uchun rahmat!\n\nSinov kunidan so'ng ish sharoitlari va jamoa sizga ma'qul keldimi?`,
        {
          inline_keyboard: [
            [{ text: "✅ Ha, ma'qul", callback_data: "onboard:sat:yes" }],
            [{ text: "❌ Yo'q, ma'qul emas", callback_data: "onboard:sat:no" }],
          ],
        }
      );
    }
    return true;
  }

  // 2. Sinov kunidan keyin "Sizga ma'qulmi?"
  if (data === "onboard:sat:no") {
    await sb
      .from("ats_onboarding_flows")
      .update({ step: "cancelled_timeout", updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    await sb
      .from("ats_applications")
      .update({
        status: "rejected",
        rejection_reason: "Nomzod sinov kunidan so'ng rad etdi",
      })
      .eq("id", flow.application_id);
    await editOrSendSimple(
      token,
      chatId,
      msgId,
      "Rahmat! Fikringiz uchun minnatdormiz. Kelgusida boshqa imkoniyatlarda ko'rishguncha!"
    );
    return true;
  }

  if (data === "onboard:sat:yes") {
    const { data: setRow } = await sb
      .from("ats_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const customFolders = setRow?.data?.onboardingFolders as OnboardingFolderItem[] | undefined;
    const folders: OnboardingFolderItem[] =
      customFolders && customFolders.length > 0 ? customFolders : DEFAULT_ONBOARDING_FOLDERS;

    // Avtomatik "Ish taklifi" (offer) bosqichiga o'tkazish
    await sb
      .from("ats_applications")
      .update({
        current_stage: "offer",
        status: "offered",
        offer_sent_at: new Date().toISOString(),
        stage_entered_at: new Date().toISOString(),
      })
      .eq("id", flow.application_id);

    await sb
      .from("ats_onboarding_flows")
      .update({
        step: "awaiting_welcome_agree",
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);

    const activeFolders = folders.filter((f) => f.enabled !== false);
    const standardsSummary = activeFolders
      .map((f) => `📌 <b>${f.title}</b>\n${f.description}`)
      .join("\n\n");

    const offerMsg =
      `🎉 <b>Tabriklaymiz, ${cand?.full_name || ""}! Sizga ISH TAKLIFI:</b>\n\n` +
      `💼 <b>Lavozim:</b> ${vac?.position || "—"}\n` +
      `🏢 <b>Do'kon / Filial:</b> ${vac?.branch || "—"}\n` +
      `🕒 <b>Smena:</b> ${flow.shift || vac?.shift || "—"}\n` +
      `💰 <b>Maosh:</b> ${vac?.salary_band || "—"}\n` +
      (standardsSummary ? `\n${standardsSummary}\n` : "");

    const hasImages = activeFolders.some((f) => f.images && f.images.length > 0);
    if (!hasImages) {
      await editOrSendSimple(
        token,
        chatId,
        msgId,
        `${offerMsg}\nTanishib chiqdingizmi? Ishga kirishga rozimisiz?`,
        {
          inline_keyboard: [
            [{ text: "✅ Ishga kirishga roziman", callback_data: "onboard:welcome:yes" }],
            [{ text: "❌ Rad etaman", callback_data: "onboard:welcome:no" }],
          ],
        }
      );
    } else {
      await editOrSendSimple(token, chatId, msgId, offerMsg);
      for (const folder of activeFolders) {
        if (folder.images && folder.images.length > 0) {
          await sendTelegramPhoto(String(chatId), folder.images[0], `📌 <b>${folder.title}</b>`);
          for (let i = 1; i < folder.images.length; i++) {
            await sendTelegramPhoto(String(chatId), folder.images[i]);
          }
        }
      }
      await sendTelegramMessage(
        String(chatId),
        `Tanishib chiqdingizmi? Ishga kirishga rozimisiz?`,
        {
          inline_keyboard: [
            [{ text: "✅ Ishga kirishga roziman", callback_data: "onboard:welcome:yes" }],
            [{ text: "❌ Rad etaman", callback_data: "onboard:welcome:no" }],
          ],
        }
      );
    }
    return true;
  }

  // 3. Welcome Book va Ish taklifiga rozilik -> Rad etsa sabab so'rash / Rozi bo'lsa Hujjatlar bosqichi
  if (data === "onboard:welcome:no") {
    await editOrSendSimple(
      token,
      chatId,
      msgId,
      "Tushunarli. Iltimos, ish taklifini rad etish sababingizni tanlang (bu bizga xizmatimizni yaxshilashga yordam beradi):",
      {
        inline_keyboard: [
          [{ text: "💰 Oylik maosh to'g'ri kelmadi", callback_data: "onboard:decline_reason:Oylik maosh to'g'ri kelmadi" }],
          [{ text: "🕒 Ish grafigi / smena to'g'ri kelmadi", callback_data: "onboard:decline_reason:Ish grafigi / smena to'g'ri kelmadi" }],
          [{ text: "📍 Manzil / filial uzoq", callback_data: "onboard:decline_reason:Manzil / filial uzoq" }],
          [{ text: "🔄 Boshqa ish topdim", callback_data: "onboard:decline_reason:Boshqa ish topdim" }],
          [{ text: "💬 Boshqa sabab", callback_data: "onboard:decline_reason:Boshqa sabab" }],
        ],
      }
    );
    return true;
  }

  if (data.startsWith("onboard:decline_reason:")) {
    const reason = data.replace("onboard:decline_reason:", "").trim() || "Ish taklifi rad etildi";
    await sb
      .from("ats_onboarding_flows")
      .update({ step: "cancelled_timeout", updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    await sb
      .from("ats_applications")
      .update({
        status: "rejected",
        rejection_reason: `Ish taklifini rad etdi: ${reason}`,
      })
      .eq("id", flow.application_id);
    await editOrSendSimple(
      token,
      chatId,
      msgId,
      "Fikringiz uchun rahmat! Qiziqish bildirganingizdan xursandmiz, kelgusida omad tilaymiz."
    );
    return true;
  }

  if (data === "onboard:welcome:yes") {
    const nowIso = new Date().toISOString();
    // Avtomatik "Hujjatlar" (hujjat_lms) bosqichiga o'tkazish
    await sb
      .from("ats_applications")
      .update({
        current_stage: "hujjat_lms",
        stage_entered_at: nowIso,
      })
      .eq("id", flow.application_id);

    await sb
      .from("ats_onboarding_flows")
      .update({
        step: "awaiting_passport_front",
        docs_requested_at: nowIso,
        last_reminder_at: nowIso,
        reminder_count: 0,
        updated_at: nowIso,
      })
      .eq("id", flow.id);

    await editOrSendSimple(
      token,
      chatId,
      msgId,
      `📄 <b>Hujjatlar (1/4)</b>\n\n` +
        `📸 <b>Pasport yoki ID kartangizning OLD tomoni</b> rasmini yuboring (yorug' va aniq ko'rinsin).`
    );
    return true;
  }

  // 4. Shaxsiy ma'lumotlarni qayta ishlashga ruxsat -> Ishga qabul + ertangi ishga chiqish sanasi
  if (data === "onboard:dataconsent:no") {
    await sb
      .from("ats_onboarding_flows")
      .update({ step: "cancelled_timeout", updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    await sb
      .from("ats_applications")
      .update({
        status: "rejected",
        rejection_reason: "Ma'lumotlarni qayta ishlashga ruxsat bermadi",
      })
      .eq("id", flow.application_id);
    await editOrSendSimple(
      token,
      chatId,
      msgId,
      "Tushunarli. Ma'lumotlaringiz qayta ishlanmadi va ariza bekor qilindi."
    );
    return true;
  }

  if (data === "onboard:dataconsent:yes") {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const tashkentTomorrow = new Date(nowMs + 5 * 3600 * 1000 + 86400000);
    const tomorrowIso = tashkentTomorrow.toISOString().slice(0, 10);
    const [ty, tm, td] = tomorrowIso.split("-");
    const tomorrowDisplay = `${td}.${tm}.${ty}`;

    await sb
      .from("ats_onboarding_flows")
      .update({
        step: "completed",
        updated_at: nowIso,
      })
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

    await appendHujjatlarRowToSheets({
      existingSpreadsheetId: setRow?.data?.googleSpreadsheetId,
      row: {
        date: nowIso.slice(0, 10),
        fullName: cand?.full_name || "—",
        phone: flow.doc_phone || cand?.phone || "—",
        branch: vac?.branch || "—",
        position: vac?.position || "—",
        shift: flow.shift || vac?.shift || "—",
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
      title: "Yangi xodim ishga qabul qilindi!",
      message: `${cand?.full_name || "Nomzod"} hujjatlarni yakunladi va rozilik berdi. Ishga chiqish sanasi: ${tomorrowDisplay}.`,
      type: "success",
      read: false,
      related_application_id: flow.application_id,
    });

    await editOrSendSimple(
      token,
      chatId,
      msgId,
      `🎉 <b>Tabriklaymiz, ${cand?.full_name || ""}! Siz ishga qabul qilindingiz!</b>\n\n` +
        `📅 Ishga chiqish sanangiz: <b>${tomorrowDisplay}</b> (ertaga)\n` +
        `🏢 Filial: <b>${vac?.branch || "—"}</b>\n` +
        `💼 Lavozim: <b>${vac?.position || "—"}</b>\n` +
        `🕒 Smena: <b>${flow.shift || vac?.shift || "—"}</b> (15 daqiqa oldin kelishni unutmang)\n\n` +
        `Aura jamoasiga xush kelibsiz! 🤝`
    );
    return true;
  }

  return true;
}

export async function handleOnboardingMessage(
  token: string,
  chatId: number,
  msg: {
    text?: string;
    contact?: { phone_number?: string };
    photo?: Array<{ file_id: string }>;
  }
): Promise<boolean> {
  const sb = getSupabase();
  const { data: flow } = await sb
    .from("ats_onboarding_flows")
    .select("*")
    .eq("chat_id", String(chatId))
    .in("step", [
      "in_survey",
      "awaiting_passport_front",
      "awaiting_passport_back",
      "awaiting_doc_phone",
      "awaiting_photo_3x4",
    ])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!flow) return false;

  const text = (msg.text || "").trim();

  // 1. Sinov kuni so'rovnomasi
  if (flow.step === "in_survey") {
    if (!text) {
      await sendTelegramMessage(String(chatId), "Iltimos, javobingizni matn shaklida yuboring:");
      return true;
    }

    const { data: setRow } = await sb
      .from("ats_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const customItems = setRow?.data?.testDaySurveyItems as SurveyQuestionItem[] | undefined;
    const surveyItems: SurveyQuestionItem[] =
      customItems && customItems.length > 0 ? customItems : DEFAULT_SURVEY_ITEMS;

    const currentIdx = Number(flow.survey_index || 0);
    const prevAnswers: { question: string; answer: string }[] = Array.isArray(flow.survey_answers)
      ? flow.survey_answers
      : [];
    const nextAnswers = [
      ...prevAnswers,
      { question: surveyItems[currentIdx]?.question || `Savol ${currentIdx + 1}`, answer: text },
    ];

    if (currentIdx + 1 < surveyItems.length) {
      const nextQ = surveyItems[currentIdx + 1];
      await sb
        .from("ats_onboarding_flows")
        .update({
          survey_index: currentIdx + 1,
          survey_answers: nextAnswers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flow.id);
      const ratingMarkup =
        nextQ.type === "rating"
          ? {
              inline_keyboard: [
                [1, 2, 3, 4, 5].map((n) => ({
                  text: `${n} ⭐️`,
                  callback_data: `onboard:rate:${currentIdx + 1}:${n}`,
                })),
              ],
            }
          : undefined;
      await sendTelegramMessage(String(chatId), `<b>${nextQ.question}</b>`, ratingMarkup);
    } else {
      await sb
        .from("ats_onboarding_flows")
        .update({
          step: "awaiting_test_satisfaction",
          survey_answers: nextAnswers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flow.id);
      await sendTelegramMessage(
        String(chatId),
        `✅ So'rovnoma uchun rahmat!\n\nSinov kunidan so'ng ish sharoitlari va jamoa sizga ma'qul keldimi?`,
        {
          inline_keyboard: [
            [{ text: "✅ Ha, ma'qul", callback_data: "onboard:sat:yes" }],
            [{ text: "❌ Yo'q, ma'qul emas", callback_data: "onboard:sat:no" }],
          ],
        }
      );
    }
    return true;
  }

  // 2. Pasport / ID oldi
  if (flow.step === "awaiting_passport_front") {
    const photo = msg.photo?.[msg.photo.length - 1];
    if (!photo) {
      await sendTelegramMessage(
        String(chatId),
        "📸 Iltimos, Pasport yoki ID kartangizning <b>OLD tomoni</b>ni rasm (foto) shaklida yuboring."
      );
      return true;
    }
    const url = `/api/telegram/file?file_id=${encodeURIComponent(photo.file_id)}`;
    await addDocument({
      applicationId: flow.application_id,
      docType: "pasport_id",
      fileName: "pasport_oldi.jpg",
      fileUrl: url,
      actorName: "Telegram Bot",
    });
    await sb
      .from("ats_onboarding_flows")
      .update({
        passport_front_file_id: photo.file_id,
        step: "awaiting_passport_back",
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);
    await sendTelegramMessage(
      String(chatId),
      `📄 <b>Hujjatlarni yuborish (2/4)</b>\n\nEndi <b>Pasport yoki ID kartangizning ORQA tomoni</b> rasmini yuboring:`
    );
    return true;
  }

  // 3. Pasport / ID orqasi
  if (flow.step === "awaiting_passport_back") {
    const photo = msg.photo?.[msg.photo.length - 1];
    if (!photo) {
      await sendTelegramMessage(
        String(chatId),
        "📸 Iltimos, Pasport yoki ID kartangizning <b>ORQA tomoni</b>ni rasm (foto) shaklida yuboring."
      );
      return true;
    }
    const url = `/api/telegram/file?file_id=${encodeURIComponent(photo.file_id)}`;
    await addDocument({
      applicationId: flow.application_id,
      docType: "pasport_id",
      fileName: "pasport_orqasi.jpg",
      fileUrl: url,
      actorName: "Telegram Bot",
    });
    await sb
      .from("ats_onboarding_flows")
      .update({
        passport_back_file_id: photo.file_id,
        step: "awaiting_doc_phone",
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);
    await sendTelegramMessage(
      String(chatId),
      `📞 <b>Hujjatlarni yuborish (3/4)</b>\n\nRasmiy hujjatlar uchun faol <b>telefon raqamingizni</b> yozing (masalan: +998901234567):`
    );
    return true;
  }

  // 4. Telefon raqami
  if (flow.step === "awaiting_doc_phone") {
    const phone = msg.contact?.phone_number || text;
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      await sendTelegramMessage(
        String(chatId),
        "📞 Iltimos, to'g'ri telefon raqamingizni yozing (masalan: +998901234567):"
      );
      return true;
    }
    await sb
      .from("ats_onboarding_flows")
      .update({
        doc_phone: phone,
        step: "awaiting_photo_3x4",
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);
    await sendTelegramMessage(
      String(chatId),
      `🪪 <b>Hujjatlarni yuborish (4/4)</b>\n\nOxirgi qadam: <b>3x4 o'lchamdagi rasmiy rasmingizni</b> yuboring (oq fonda, yuzingiz aniq ko'ringan holda):`
    );
    return true;
  }

  // 5. 3x4 rasm va Google Sheets 'Hujjatlar' listiga yozish
  if (flow.step === "awaiting_photo_3x4") {
    const photo = msg.photo?.[msg.photo.length - 1];
    if (!photo) {
      await sendTelegramMessage(
        String(chatId),
        "📸 Iltimos, <b>3x4 rasmingizni</b> foto shaklida yuboring."
      );
      return true;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rekruting-ats.onrender.com";
    const photo3x4Path = `/api/telegram/file?file_id=${encodeURIComponent(photo.file_id)}`;
    await addDocument({
      applicationId: flow.application_id,
      docType: "photo_3x4",
      fileName: "rasm_3x4.jpg",
      fileUrl: photo3x4Path,
      actorName: "Telegram Bot",
    });

    const nowIso = new Date().toISOString();
    await sb
      .from("ats_onboarding_flows")
      .update({
        photo_3x4_file_id: photo.file_id,
        step: "awaiting_data_consent",
        updated_at: nowIso,
      })
      .eq("id", flow.id);

    await sendTelegramMessage(
      String(chatId),
      `📋 <b>Barcha hujjatlaringiz qabul qilindi!</b>\n\n` +
        `Shaxsiy ma'lumotlaringizni qayta ishlash va sizni rasmiy ishga qabul qilish jarayonini yakunlashga ruxsat berasizmi?`,
      {
        inline_keyboard: [
          [{ text: "✅ Ha, ruxsat beraman (Tasdiqlash)", callback_data: "onboard:dataconsent:yes" }],
          [{ text: "❌ Bekor qilish", callback_data: "onboard:dataconsent:no" }],
        ],
      }
    );
    return true;
  }

  return false;
}
