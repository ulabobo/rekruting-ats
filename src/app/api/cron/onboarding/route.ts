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

    if (!flows || flows.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

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

    for (const flow of flows) {
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

    return NextResponse.json({
      ok: true,
      processed: flows.length,
      morningSent,
      surveyStarted,
      remindersSent,
      timedOut,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cron xatosi" },
      { status: 500 }
    );
  }
}
