import { addDocument, getSupabase } from "@/lib/supabase-db";
import { appendHujjatlarRowToSheets } from "@/lib/google-sheets";
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
    await sb
      .from("ats_onboarding_flows")
      .update({
        test_date: chosenDate,
        step: "test_date_selected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);

    await editOrSendSimple(
      token,
      chatId,
      msgId,
      `✅ <b>Sinov kuni sanasi tasdiqlandi!</b>\n\n` +
        `📅 Sana: <b>${d}.${m}.${y}</b>\n` +
        `🏢 Filial: <b>${vac?.branch || "—"}</b>\n` +
        `💼 Lavozim: <b>${vac?.position || "—"}</b>\n` +
        `🕒 Smena: <b>${flow.shift || vac?.shift || "—"}</b>\n\n` +
        `Sinov kuni ertalab sizga eslatma xabari yuboramiz. Omad!`
    );
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

    const offerMsg =
      `🎉 <b>Tabriklaymiz, ${cand?.full_name || ""}! Sizga rasmiy ISH TAKLIFI!</b>\n\n` +
      `💼 Lavozim: <b>${vac?.position || "—"}</b>\n` +
      `🏢 Do'kon / Filial: <b>${vac?.branch || "—"}</b>\n` +
      `🕒 Smena: <b>${flow.shift || vac?.shift || "—"}</b>\n` +
      `💰 Oylik maosh: <b>${vac?.salary_band || "—"}</b>\n\n` +
      `Quyida kompaniyamiz standartlari va Welcome Book bilan tanishing 👇`;

    await editOrSendSimple(token, chatId, msgId, offerMsg);

    for (const folder of folders) {
      const caption = `📌 <b>${folder.title}</b>\n\n${folder.description}`;
      if (folder.images && folder.images.length > 0) {
        await sendTelegramPhoto(String(chatId), folder.images[0], caption);
        for (let i = 1; i < folder.images.length; i++) {
          await sendTelegramPhoto(String(chatId), folder.images[i]);
        }
      } else {
        await sendTelegramMessage(String(chatId), caption);
      }
    }

    await sendTelegramMessage(
      String(chatId),
      `Barcha standartlar va shartlar bilan tanishib chiqdingizmi? Sizga ma'qulmi?`,
      {
        inline_keyboard: [
          [{ text: "✅ Tanishib chiqdim, menga ma'qul", callback_data: "onboard:welcome:yes" }],
          [{ text: "❌ Rad etaman", callback_data: "onboard:welcome:no" }],
        ],
      }
    );
    return true;
  }

  // 3. Welcome Book va Ish taklifiga rozilik -> Hujjatlar bosqichi
  if (data === "onboard:welcome:no") {
    await sb
      .from("ats_onboarding_flows")
      .update({ step: "cancelled_timeout", updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    await sb
      .from("ats_applications")
      .update({
        status: "rejected",
        rejection_reason: "Nomzod ish taklifini rad etdi",
      })
      .eq("id", flow.application_id);
    await editOrSendSimple(
      token,
      chatId,
      msgId,
      "Tushunarli. Qiziqish bildirganingiz uchun rahmat!"
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
      `📄 <b>Hujjatlarni yuborish bosqichi (1/4)</b>\n\n` +
        `Iltimos, <b>Pasport yoki ID kartangizning OLD tomoni</b> rasmini yuboring.\n\n` +
        `💡 <i>Namuna: Hujjat yorug' joyda, barcha yozuvlar va rasm aniq ko'rinadigan qilib (chetlari kesilmagan holda) suratga oling.</i>\n\n` +
        `⚠️ Eslatma: Hujjatlar 24 soat ichida yuborilmasa, nomzodlik bekor qilinadi.`
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

    await sb
      .from("ats_onboarding_flows")
      .update({
        photo_3x4_file_id: photo.file_id,
        step: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);

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
    const { data: setRow } = await sb
      .from("ats_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();

    const frontUrl = flow.passport_front_file_id
      ? `${baseUrl}/api/telegram/file?file_id=${encodeURIComponent(flow.passport_front_file_id)}`
      : "";
    const backUrl = flow.passport_back_file_id
      ? `${baseUrl}/api/telegram/file?file_id=${encodeURIComponent(flow.passport_back_file_id)}`
      : "";
    const p3x4Url = `${baseUrl}${photo3x4Path}`;
    const surveyArr: { question: string; answer: string }[] = Array.isArray(flow.survey_answers)
      ? flow.survey_answers
      : [];
    const surveySummary = surveyArr.map((s) => `${s.question}: ${s.answer}`).join(" | ");

    await appendHujjatlarRowToSheets({
      existingSpreadsheetId: setRow?.data?.googleSpreadsheetId,
      row: {
        date: new Date().toISOString().slice(0, 10),
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
      title: "Hujjatlar to'liq qabul qilindi",
      message: `${cand?.full_name || "Nomzod"} barcha hujjatlarini (pasport oldi/orqasi, telefon, 3x4 rasm) bot orqali yubordi va Google Sheets'ga saqlandi.`,
      type: "success",
      read: false,
      related_application_id: flow.application_id,
    });

    await sendTelegramMessage(
      String(chatId),
      `✅ <b>Tabriklaymiz, ${cand?.full_name || ""}!</b>\n\n` +
        `Barcha hujjatlaringiz muvaffaqiyatli qabul qilindi va tizimga kiritildi.\n` +
        `Tez orada HR menejerimiz ishga chiqish tafsilotlari bo'yicha siz bilan bog'lanadi!`
    );
    return true;
  }

  return false;
}
