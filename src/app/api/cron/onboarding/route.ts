import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-db";
import { DEFAULT_SURVEY_ITEMS, sendTelegramMessage } from "@/lib/telegram";
import { SurveyQuestionItem } from "@/types/ats";

export const dynamic = "force-dynamic";

function getShiftEndHour(shift?: string): number {
  const s = (shift || "").toLowerCase();
  if (s.includes("2-smena") || s.includes("14:00") || s.includes("23:00")) return 23;
  return 18; // 1-smena (09:00-18:00), 2/2, 5/2
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data: flows } = await sb
      .from("ats_onboarding_flows")
      .select("*")
      .not("step", "in", '("completed","cancelled_timeout")');

    const activeFlows = flows || [];
    const { data: setRow } = await sb
      .from("ats_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();

    const customItems = setRow?.data?.testDaySurveyItems as SurveyQuestionItem[] | undefined;
    const surveyItems: SurveyQuestionItem[] =
      customItems && customItems.length > 0 ? customItems : DEFAULT_SURVEY_ITEMS;

    const nowMs = Date.now();
    const tashkentNow = new Date(nowMs + 5 * 3600 * 1000);
    const todayIso = tashkentNow.toISOString().slice(0, 10);
    const tashkentHour = tashkentNow.getUTCHours();

    let morningSent = 0;
    let surveyStarted = 0;
    let remindersSent = 0;
    let timedOut = 0;

    for (const flow of activeFlows) {
      const { data: cand } = await sb
        .from("ats_candidates")
        .select("id, full_name")
        .eq("id", flow.candidate_id)
        .maybeSingle();
      const { data: app } = await sb
        .from("ats_applications")
        .select("id, vacancy_id, status")
        .eq("id", flow.application_id)
        .maybeSingle();
      if (!cand || !app || app.status === "rejected" || app.status === "blacklist") continue;

      const { data: vac } = await sb
        .from("ats_vacancies")
        .select("branch, position")
        .eq("id", app.vacancy_id)
        .maybeSingle();

      // 1. Sinov kuni ertalabki xabar
      if (
        flow.step === "test_date_selected" &&
        flow.test_date &&
        todayIso === flow.test_date &&
        tashkentHour >= 8
      ) {
        await sendTelegramMessage(
          flow.chat_id,
          `☀️ <b>Xayrli tong, ${cand.full_name}!</b>\n\n` +
            `Bugun sizda <b>${vac?.branch || "filial"}</b>da <b>${vac?.position || "lavozim"}</b> bo'yicha <b>sinov kuni</b>.\n` +
            `Sizga omad tilaymiz! 💪`
        );
        await sb
          .from("ats_onboarding_flows")
          .update({ step: "test_morning_sent", updated_at: new Date().toISOString() })
          .eq("id", flow.id);
        morningSent++;
        continue;
      }

      // 2. Smena tugagandan keyin so'rovnoma boshlash
      const shiftEndHour = getShiftEndHour(flow.shift);
      if (
        flow.step === "test_morning_sent" &&
        flow.test_date &&
        (todayIso > flow.test_date ||
          (todayIso === flow.test_date && tashkentHour >= shiftEndHour))
      ) {
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
          flow.chat_id,
          `📝 <b>Bugungi sinov kuningiz yakunlandi!</b>\n\n` +
            `Iltimos, sinov kuni haqida kichik so'rovnomadan o'ting:\n\n` +
            `<b>${firstQ.question}</b>`,
          ratingMarkup
        );
        await sb
          .from("ats_onboarding_flows")
          .update({
            step: "in_survey",
            survey_index: 0,
            survey_answers: [],
            updated_at: new Date().toISOString(),
          })
          .eq("id", flow.id);
        surveyStarted++;
        continue;
      }

      // 3. Hujjatlar uchun har 1 soatda eslatma va 24 soatda bekor qilish
      if (
        [
          "awaiting_passport_front",
          "awaiting_passport_back",
          "awaiting_doc_phone",
          "awaiting_photo_3x4",
        ].includes(flow.step) &&
        flow.docs_requested_at
      ) {
        const reqAt = new Date(flow.docs_requested_at).getTime();
        const lastRemAt = flow.last_reminder_at
          ? new Date(flow.last_reminder_at).getTime()
          : reqAt;
        const hoursElapsed = (nowMs - reqAt) / 3600000;

        if (hoursElapsed >= 24) {
          await sb
            .from("ats_onboarding_flows")
            .update({ step: "cancelled_timeout", updated_at: new Date().toISOString() })
            .eq("id", flow.id);
          await sb
            .from("ats_applications")
            .update({
              status: "rejected",
              rejection_reason: "24 soat ichida hujjatlar yuborilmadi",
            })
            .eq("id", flow.application_id);
          await sendTelegramMessage(
            flow.chat_id,
            `❌ Hurmatli ${cand.full_name}, 24 soat ichida hujjatlaringiz yuborilmaganligi sababli nomzodligingiz bekor qilindi.`
          );
          timedOut++;
        } else if (nowMs - lastRemAt >= 3600000) {
          const remainingHours = Math.max(1, Math.ceil(24 - hoursElapsed));
          await sendTelegramMessage(
            flow.chat_id,
            `⏰ <b>Eslatma:</b> Iltimos, so'ralgan hujjatlarni yuboring!\n` +
              `Agar 24 soat ichida hujjatlar yuborilmasa, nomzodligingiz avtomatik bekor qilinadi.\n` +
              `⏳ Qolgan vaqt: ~<b>${remainingHours} soat</b>.`
          );
          await sb
            .from("ats_onboarding_flows")
            .update({
              last_reminder_at: new Date().toISOString(),
              reminder_count: (flow.reminder_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", flow.id);
          remindersSent++;
        }
      }
    }

    // 4. Yarim yo'lda to'xtab qolganlarga 2 bosqichli aqlli eslatma (10 daqiqa + 4 soat) + inline "Davom ettirish" tugmasi
    let abandonedReminded = 0;
    const tenMinAgoIso = new Date(nowMs - 10 * 60 * 1000).toISOString();
    const fourHoursAgoMs = nowMs - 4 * 60 * 60 * 1000;

    const { data: abandoned } = await sb
      .from("ats_bot_funnel")
      .select("chat_id, first_name, furthest_rank, reminded_at, reminder_count, updated_at")
      .eq("status", "in_progress")
      .gte("furthest_rank", 2)
      .lt("updated_at", tenMinAgoIso)
      .limit(40);

    for (const ab of abandoned || []) {
      const remCount = Number(ab.reminder_count || (ab.reminded_at ? 1 : 0));
      if (remCount >= 2) continue;

      // 1-eslatma: 10 daqiqadan keyin; 2-eslatma: 1-eslatmadan 4 soat o'tgach
      if (remCount === 1) {
        const lastRemMs = ab.reminded_at ? new Date(ab.reminded_at).getTime() : 0;
        if (!lastRemMs || lastRemMs > fourHoursAgoMs) continue;
      }

      const pct = Math.min(90, Math.max(25, Math.round((Number(ab.furthest_rank || 3) / 13) * 100)));
      const msgText =
        remCount === 0
          ? `👋 Salom${ab.first_name ? `, <b>${ab.first_name}</b>` : ""}!\n\n` +
            `Anketangizning <b>${pct}% qismi tayyor</b> — yakunlash uchun atigi 1 daqiqa qoldi.\n` +
            `Pastdagi tugmani bosing va to'xtagan savolingizdan darhol davom eting:`
          : `🔥 <b>${ab.first_name || "Hurmatli nomzod"}</b>, vakansiyaga qabul davom etmoqda!\n\n` +
            `Anketangiz <b>${pct}% to'ldirilgan</b> holda saqlanib turibdi. Joylar soni cheklangan — hoziroq 1 bosishda yakunlab yuboring:`;

      const r = await sendTelegramMessage(ab.chat_id, msgText, {
        inline_keyboard: [
          [
            {
              text: remCount === 0 ? "▶️ Anketani davom ettirish" : "▶️ Hozir yakunlash (1 daqiqa)",
              callback_data: "resume_anketa",
            },
          ],
        ],
      });

      if (r.ok) {
        await sb
          .from("ats_bot_funnel")
          .update({
            reminded_at: new Date().toISOString(),
            reminder_count: remCount + 1,
          })
          .eq("chat_id", ab.chat_id);
        abandonedReminded++;
      }
    }

    return NextResponse.json({
      ok: true,
      processed: activeFlows.length,
      morningSent,
      surveyStarted,
      remindersSent,
      timedOut,
      abandonedReminded,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cron xatosi" },
      { status: 500 }
    );
  }
}
