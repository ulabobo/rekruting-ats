import { NextRequest, NextResponse } from "next/server";
import {
  addDocument,
  createApplicationFromLead,
  createReserveCandidate,
  getSupabase,
  normalizePhone,
} from "@/lib/supabase-db";
import { sendTelegramMessage } from "@/lib/telegram";
import { TRACK_CONFIGS } from "@/lib/stages";
import { TrackType } from "@/types/ats";

const CITIES = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan"];

const sessions = new Map<
  number,
  {
    mode: "apply" | "reserve";
    step: "idle" | "fullName" | "phone" | "address" | "experience" | "consent";
    vacancyId?: string;
    city?: string;
    fullName?: string;
    phone?: string;
    address?: string;
    experience?: string;
  }
>();

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return NextResponse.json({ ok: false });

    const sb = getSupabase();

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id as number;
      const data = cq.data as string;

      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id }),
      });

      if (data.startsWith("city:")) {
        const city = data.replace("city:", "");
        const { data: vacs } = await sb
          .from("ats_vacancies")
          .select("*")
          .eq("status", "open")
          .ilike("city", city);

        if (vacs && vacs.length > 0) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📍 <b>${city}</b> shahridagi bo'sh ish o'rinlari:`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: vacs.map((v) => [
                  { text: `${v.position} — ${v.branch}`, callback_data: `apply:${v.id}` },
                ]),
              },
            }),
          });
        } else {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text:
                `Hozircha <b>${city}</b> shahrida bo'sh ish o'rni mavjud emas.\n\n` +
                `Ammo yangi joy ochilishi bilan sizga birinchilardan bo'lib xabar beramiz! Ungacha zaxira anketasini to'ldirib qo'yishingiz mumkin:`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📝 Zaxira anketasini to'ldirish", callback_data: `reserve:${city}` }],
                ],
              },
            }),
          });
        }
      } else if (data.startsWith("reserve:")) {
        const city = data.replace("reserve:", "");
        sessions.set(chatId, { mode: "reserve", step: "fullName", city });
        await sendTelegramMessage(
          String(chatId),
          `📍 Zaxira anketasi (<b>${city}</b>)\n\n1/4. To'liq ism-familiyangizni (F.I.O) kiriting:`
        );
      } else if (data.startsWith("apply:")) {
        const vacancyId = data.replace("apply:", "");
        sessions.set(chatId, { mode: "apply", step: "fullName", vacancyId });
        await sendTelegramMessage(
          String(chatId),
          "1/5. To'liq ism-familiyangizni (F.I.O) kiriting:"
        );
      } else if (data === "consent:yes") {
        const st = sessions.get(chatId);
        if (st?.mode === "reserve" && st.city && st.phone && st.fullName) {
          await createReserveCandidate({
            phone: st.phone,
            fullName: st.fullName,
            city: st.city,
            experienceYears: st.experience,
            telegramChatId: String(chatId),
            telegramUsername: cq.from?.username ? `@${cq.from.username}` : undefined,
          });
          sessions.set(chatId, { mode: "apply", step: "idle" });
          await sendTelegramMessage(
            String(chatId),
            `✅ Ma'lumotlaringiz <b>${st.city}</b> shahri bo'yicha zaxiraga saqlandi! Yangi o'rin ochilishi bilan sizga xabar beramiz.`
          );
        } else if (st?.vacancyId && st.phone && st.fullName) {
          await createApplicationFromLead({
            phone: st.phone,
            fullName: st.fullName,
            vacancyId: st.vacancyId,
            source: "Telegram bot",
            address: st.address,
            experienceYears: st.experience,
            telegramChatId: String(chatId),
            telegramUsername: cq.from?.username ? `@${cq.from.username}` : undefined,
          });
          sessions.set(chatId, { mode: "apply", step: "idle" });
          await sendTelegramMessage(
            String(chatId),
            "✅ Arizangiz qabul qilindi! Har bir bosqich o'zgarishi haqida shu bot orqali xabar beramiz."
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id as number;
    const text = (msg.text || "").trim();

    if (text === "/start") {
      sessions.set(chatId, { mode: "apply", step: "idle" });
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Assalomu alaykum! Rekruting ATS tizimiga xush kelibsiz.\nBo'sh ish o'rinlarini ko'rish uchun tugmani bosing:",
          reply_markup: {
            keyboard: [[{ text: "📋 Bo'sh ish o'rinlari" }, { text: "📄 Ariza holati" }]],
            resize_keyboard: true,
          },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    if (text === "📋 Bo'sh ish o'rinlari") {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Qaysi shaharda ishlamoqchisiz? Shaharni tanlang:",
          reply_markup: {
            inline_keyboard: CITIES.map((c) => [{ text: `📍 ${c}`, callback_data: `city:${c}` }]),
          },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    if (text === "📄 Ariza holati") {
      const { data: cand } = await sb
        .from("ats_candidates")
        .select("id")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();
      if (!cand) {
        await sendTelegramMessage(String(chatId), "Siz hali ariza topshirmagansiz.");
        return NextResponse.json({ ok: true });
      }
      const { data: apps } = await sb
        .from("ats_applications")
        .select("*")
        .eq("candidate_id", cand.id);
      const lines = (apps || []).map((a) => {
        const st =
          TRACK_CONFIGS[a.track as TrackType]?.stages.find(
            (s) => s.id === a.current_stage
          )?.labelUz || a.current_stage;
        return `• Bosqich: <b>${st}</b> | Holat: ${a.status}`;
      });
      await sendTelegramMessage(
        String(chatId),
        lines.length ? lines.join("\n") : "Siz zaxira ro'yxatidasiz. Bo'sh o'rin ochilsa xabar beramiz."
      );
      return NextResponse.json({ ok: true });
    }

    if (msg.photo) {
      const { data: cand } = await sb
        .from("ats_candidates")
        .select("id, full_name")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();
      if (cand) {
        const { data: app } = await sb
          .from("ats_applications")
          .select("id")
          .eq("candidate_id", cand.id)
          .order("applied_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (app) {
          const photo = msg.photo[msg.photo.length - 1];
          await addDocument({
            applicationId: app.id,
            docType: "pasport_id",
            fileName: `tg_passport_${photo.file_id.slice(0, 8)}.jpg`,
            fileUrl: `telegram://file/${photo.file_id}`,
            actorName: cand.full_name,
          });
          await sendTelegramMessage(String(chatId), "✅ Pasport / ID karta rasmingiz qabul qilindi!");
        }
      }
      return NextResponse.json({ ok: true });
    }

    const st = sessions.get(chatId);
    if (!st || st.step === "idle") return NextResponse.json({ ok: true });

    if (st.step === "fullName") {
      st.fullName = text;
      st.step = "phone";
      sessions.set(chatId, st);
      await sendTelegramMessage(String(chatId), "2. Telefon raqamingizni kiriting (+998901234567):");
    } else if (st.step === "phone" || msg.contact) {
      st.phone = normalizePhone(msg.contact?.phone_number || text);
      if (st.mode === "reserve") {
        st.step = "experience";
        sessions.set(chatId, st);
        await sendTelegramMessage(String(chatId), "3/4. Ish tajribangizni yozing:");
      } else {
        st.step = "address";
        sessions.set(chatId, st);
        await sendTelegramMessage(String(chatId), "3/5. Yashash manzilingizni kiriting:");
      }
    } else if (st.step === "address") {
      st.address = text;
      st.step = "experience";
      sessions.set(chatId, st);
      await sendTelegramMessage(String(chatId), "4/5. Ish tajribangizni yozing:");
    } else if (st.step === "experience") {
      st.experience = text;
      st.step = "consent";
      sessions.set(chatId, st);
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Ma'lumotlarni qayta ishlashga rozilik bildirasizmi?",
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Roziman, yuborish", callback_data: "consent:yes" }]],
          },
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
