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

const REGIONS = [
  "Bosh ofis",
  "Toshkent ombor",
  "Toshkent shahri",
  "Toshkent viloyati",
  "Samarqand viloyati",
  "Buxoro viloyati",
  "Farg'ona vodiysi",
];

const CITIES_BY_REGION: Record<string, string[]> = {
  "Bosh ofis": ["Toshkent"],
  "Toshkent ombor": ["Toshkent"],
  "Toshkent shahri": ["Toshkent"],
  "Toshkent viloyati": ["Chirchiq", "Olmaliq", "Angren"],
  "Samarqand viloyati": ["Samarqand"],
  "Buxoro viloyati": ["Buxoro"],
  "Farg'ona vodiysi": ["Andijon", "Farg'ona", "Namangan"],
};

const SHIFTS = ["1-smena (09:00–18:00)", "2-smena (14:00–23:00)", "2/2 smena", "To'liq kun (5/2)"];

type Step =
  | "idle"
  | "hasExp"
  | "firstName"
  | "lastName"
  | "birthDate"
  | "address"
  | "phone"
  | "gender"
  | "marital"
  | "pregnant"
  | "student"
  | "education"
  | "uzLang"
  | "ruLang"
  | "totalExp"
  | "lastWork"
  | "illness"
  | "consent";

interface SessionState {
  mode: "apply" | "reserve";
  step: Step;
  region?: string;
  city?: string;
  branch?: string;
  vacancyId?: string;
  position?: string;
  shift?: string;
  answers: Record<string, string>;
}

const sessions = new Map<number, SessionState>();

async function tgCall(token: string, method: string, body: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function editOrSend(
  token: string,
  chatId: number,
  messageId: number | undefined,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  if (messageId) {
    await tgCall(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  } else {
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }
}

async function askNextQuestion(token: string, chatId: number, st: SessionState) {
  switch (st.step) {
    case "hasExp":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "1/15. Tanlangan lavozim bo'yicha tajribangiz bormi?",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Ha", callback_data: "ans:hasExp:Ha" },
              { text: "❌ Yo'q", callback_data: "ans:hasExp:Yo'q" },
            ],
          ],
        },
      });
    case "firstName":
      return sendTelegramMessage(String(chatId), "2/15. Ismingizni kiriting:");
    case "lastName":
      return sendTelegramMessage(String(chatId), "3/15. Familiyangizni kiriting:");
    case "birthDate":
      return sendTelegramMessage(
        String(chatId),
        "4/15. Tug'ilgan sanangizni kiriting (masalan: 10.08.2002):"
      );
    case "address":
      return sendTelegramMessage(
        String(chatId),
        "5/15. Yashash manzilingizni kiriting (tuman, ko'cha, uy):"
      );
    case "phone":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "6/15. Telefon raqamingizni yuboring (+998901234567):",
        reply_markup: {
          keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    case "gender":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "7/15. Jinsingizni tanlang:",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👨 Erkak", callback_data: "ans:gender:Erkak" },
              { text: "👩 Ayol", callback_data: "ans:gender:Ayol" },
            ],
          ],
        },
      });
    case "marital":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "8/15. Oilaviy holatingiz:",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Turmush qurgan", callback_data: "ans:marital:Turmush qurgan" },
              { text: "Turmush qurmagan", callback_data: "ans:marital:Turmush qurmagan" },
            ],
          ],
        },
      });
    case "pregnant":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "9/15. Homiladormisiz?",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Ha", callback_data: "ans:pregnant:Ha" },
              { text: "Yo'q", callback_data: "ans:pregnant:Yo'q" },
            ],
          ],
        },
      });
    case "student":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "10/15. Talabamisiz?",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Ha", callback_data: "ans:student:Ha" },
              { text: "Yo'q", callback_data: "ans:student:Yo'q" },
            ],
          ],
        },
      });
    case "education":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "11/15. Ma'lumot darajangiz:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "O'rta", callback_data: "ans:education:O'rta" }],
            [{ text: "O'rta maxsus", callback_data: "ans:education:O'rta maxsus" }],
            [{ text: "Oliy ma'lumot", callback_data: "ans:education:Oliy ma'lumot" }],
          ],
        },
      });
    case "uzLang":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "12/15. O'zbek tili darajangiz:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ilg'or (erkin gapiraman)", callback_data: "ans:uzLang:Ilg'or" }],
            [{ text: "O'rta", callback_data: "ans:uzLang:O'rta" }],
            [{ text: "Past", callback_data: "ans:uzLang:Past" }],
          ],
        },
      });
    case "ruLang":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "13/15. Rus tili darajangiz:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ilg'or (erkin gapiraman)", callback_data: "ans:ruLang:Ilg'or" }],
            [{ text: "O'rta", callback_data: "ans:ruLang:O'rta" }],
            [{ text: "Past", callback_data: "ans:ruLang:Past" }],
          ],
        },
      });
    case "totalExp":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "14/15. Umumiy ish tajribangiz:",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Tajribasiz", callback_data: "ans:totalExp:Tajribasiz" },
              { text: "1 yilgacha", callback_data: "ans:totalExp:1 yilgacha" },
            ],
            [
              { text: "1–3 yil", callback_data: "ans:totalExp:1-3 yil" },
              { text: "3–5 yil", callback_data: "ans:totalExp:3-5 yil" },
            ],
            [{ text: "5+ yil", callback_data: "ans:totalExp:5+ yil" }],
          ],
        },
      });
    case "lastWork":
      return sendTelegramMessage(
        String(chatId),
        "15/15. Oxirgi ish joyingiz va nima sababdan ketganingizni yozing (agar ishlamagan bo'lsangiz «Yo'q» deb yozing):"
      );
    case "illness":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "Sog'lig'ingiz bo'yicha og'ir kasallik turi yoki ishga cheklovlar bormi?",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Yo'q, sog'lomman", callback_data: "ans:illness:Yo'q" }],
            [{ text: "⚠️ Ha, bor (izoh qoldiraman)", callback_data: "ans:illness:Ha" }],
          ],
        },
      });
    case "consent": {
      const a = st.answers;
      const summary =
        `📋 <b>Arizangizni tekshiring:</b>\n\n` +
        `📍 <b>Hudud:</b> ${a.region || "—"} / ${a.city || "—"}\n` +
        `🏢 <b>Filial:</b> ${a.branch || "—"}\n` +
        `💼 <b>Lavozim:</b> ${a.position || "—"}\n` +
        `🕒 <b>Smena:</b> ${a.shift || "—"}\n` +
        `👤 <b>F.I.O:</b> ${a.lastName || ""} ${a.firstName || ""}\n` +
        `📱 <b>Telefon:</b> ${a.phone || "—"}\n` +
        `🎓 <b>Ma'lumot:</b> ${a.education || "—"}\n` +
        `🛠 <b>Tajriba:</b> ${a.totalExp || "—"}\n\n` +
        `Ma'lumotlarni qayta ishlashga rozilik bildirib yuborasizmi?`;
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: summary,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Tasdiqlash va yuborish", callback_data: "consent:yes" }],
            [{ text: "🔄 Qaytadan boshlash", callback_data: "cancel" }],
          ],
        },
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return NextResponse.json({ ok: false });

    const sb = getSupabase();

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id as number;
      const msgId = cq.message?.message_id as number | undefined;
      const data = cq.data as string;

      await tgCall(token, "answerCallbackQuery", { callback_query_id: cq.id });

      if (data === "cancel") {
        sessions.set(chatId, { mode: "apply", step: "idle", answers: {} });
        await editOrSend(
          token,
          chatId,
          msgId,
          "❌ Ariza bekor qilindi. Yangidan boshlash uchun «📋 Bo'sh ish o'rinlari» tugmasini bosing."
        );
        return NextResponse.json({ ok: true });
      }

      if (data === "back:reg") {
        await editOrSend(
          token,
          chatId,
          msgId,
          "Qaysi hududda (yoki Bosh ofis / Ombor) ishlamoqchisiz?",
          {
            inline_keyboard: REGIONS.map((r) => [{ text: `📍 ${r}`, callback_data: `reg:${r}` }]),
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 1. Viloyat / Bosh ofis / Toshkent ombor tanlandi
      if (data.startsWith("reg:")) {
        const region = data.replace("reg:", "");
        const cities = CITIES_BY_REGION[region] || ["Toshkent"];
        sessions.set(chatId, { mode: "apply", step: "idle", region, answers: { region } });
        await editOrSend(
          token,
          chatId,
          msgId,
          `📍 Hudud: <b>${region}</b>\nEndi shaharni tanlang:`,
          {
            inline_keyboard: [
              ...cities.map((c) => [{ text: `🏙 ${c}`, callback_data: `city:${c}` }]),
              [{ text: "⬅️ Orqaga", callback_data: "back:reg" }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 2. Shahar tanlandi -> Filiallarni chiqarish
      if (data.startsWith("city:")) {
        const city = data.replace("city:", "");
        const st = sessions.get(chatId) || { mode: "apply", step: "idle", answers: {} };
        st.city = city;
        st.answers.city = city;
        sessions.set(chatId, st);

        const { data: vacs } = await sb
          .from("ats_vacancies")
          .select("*")
          .in("status", ["open", "accepted"])
          .ilike("city", city);

        if (vacs && vacs.length > 0) {
          const branches = Array.from(new Set(vacs.map((v) => v.branch)));
          await editOrSend(
            token,
            chatId,
            msgId,
            `🏙 <b>${city}</b> shahridagi filiallar (bo'sh o'rinlar bor):`,
            {
              inline_keyboard: [
                ...branches.map((b) => [{ text: `🏢 ${b}`, callback_data: `branch:${b}` }]),
                [{ text: "⬅️ Orqaga", callback_data: `reg:${st.region || "Toshkent shahri"}` }],
              ],
            }
          );
        } else {
          await editOrSend(
            token,
            chatId,
            msgId,
            `Hozircha <b>${city}</b> shahrida bo'sh ish o'rni mavjud emas.\n\n` +
              `Ammo yangi joy ochilishi bilan sizga xabar beramiz! Ungacha anketani to'ldirib qo'yishingiz mumkin:`,
            {
              inline_keyboard: [
                [{ text: "📝 Anketani to'ldirish", callback_data: `reserve:${city}` }],
                [{ text: "⬅️ Orqaga", callback_data: `reg:${st.region || "Toshkent shahri"}` }],
              ],
            }
          );
        }
        return NextResponse.json({ ok: true });
      }

      // 3. Filial tanlandi -> Lavozimlar
      if (data.startsWith("branch:")) {
        const branch = data.replace("branch:", "");
        const st = sessions.get(chatId) || { mode: "apply", step: "idle", answers: {} };
        st.branch = branch;
        st.answers.branch = branch;
        sessions.set(chatId, st);

        const { data: vacs } = await sb
          .from("ats_vacancies")
          .select("*")
          .in("status", ["open", "accepted"])
          .eq("branch", branch);

        await editOrSend(
          token,
          chatId,
          msgId,
          `🏢 <b>${branch}</b> — Lavozimni tanlang:`,
          {
            inline_keyboard: [
              ...(vacs || []).map((v) => [
                { text: `💼 ${v.position} (${v.salary_band})`, callback_data: `vac:${v.id}` },
              ]),
              [{ text: "⬅️ Orqaga", callback_data: `city:${st.city || "Toshkent"}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 4. Lavozim tanlandi -> "Sizdan kutamiz" matni + Smena tanlash
      if (data.startsWith("vac:")) {
        const vacId = data.replace("vac:", "");
        const { data: vac } = await sb
          .from("ats_vacancies")
          .select("*")
          .eq("id", vacId)
          .maybeSingle();
        if (!vac) return NextResponse.json({ ok: true });

        const st = sessions.get(chatId) || { mode: "apply", step: "idle", answers: {} };
        st.vacancyId = vac.id;
        st.position = vac.position;
        st.answers.position = vac.position;
        sessions.set(chatId, st);

        const { data: prof } = await sb
          .from("ats_position_profiles")
          .select("expectation_uz")
          .eq("track", vac.track)
          .ilike("position_name", vac.position)
          .maybeSingle();

        const expText =
          prof?.expectation_uz ||
          `✨ <b>${vac.position}</b> lavozimi bo'yicha sizdan mas'uliyat, xushmuomalalik va jamoaviy ishlashni kutamiz!`;

        await editOrSend(
          token,
          chatId,
          msgId,
          `${expText}\n\n🕒 Qulay smenani tanlang:`,
          {
            inline_keyboard: [
              ...SHIFTS.map((s) => [{ text: s, callback_data: `shift:${s}` }]),
              [{ text: "⬅️ Orqaga", callback_data: `branch:${st.branch || vac.branch}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 5. Smena tanlandi -> Anketa boshlanadi
      if (data.startsWith("shift:")) {
        const shift = data.replace("shift:", "");
        const st = sessions.get(chatId) || { mode: "apply", step: "idle", answers: {} };
        st.shift = shift;
        st.answers.shift = shift;
        st.step = "hasExp";
        sessions.set(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

      // Zaxira rejimi (lekin Zaxira belgisisiz oddiy ariza sifatida)
      if (data.startsWith("reserve:")) {
        const city = data.replace("reserve:", "");
        const st = sessions.get(chatId) || { mode: "reserve", step: "hasExp", answers: {} };
        st.mode = "reserve";
        st.city = city;
        st.answers.city = city;
        st.answers.branch = city;
        st.answers.position = "Umumiy ariza";
        st.step = "hasExp";
        sessions.set(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

      // Inline savol javoblari
      if (data.startsWith("ans:")) {
        const [, field, val] = data.split(":");
        const st = sessions.get(chatId);
        if (!st) return NextResponse.json({ ok: true });

        st.answers[field] = val;

        if (field === "hasExp") st.step = "firstName";
        else if (field === "gender") st.step = "marital";
        else if (field === "marital") {
          if (st.answers.gender === "Ayol" && val === "Turmush qurgan") {
            st.step = "pregnant";
          } else {
            st.step = "student";
          }
        } else if (field === "pregnant") st.step = "student";
        else if (field === "student") st.step = "education";
        else if (field === "education") st.step = "uzLang";
        else if (field === "uzLang") st.step = "ruLang";
        else if (field === "ruLang") st.step = "totalExp";
        else if (field === "totalExp") st.step = "lastWork";
        else if (field === "illness") st.step = "consent";

        sessions.set(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

      // Yakuniy rozilik
      if (data === "consent:yes") {
        const st = sessions.get(chatId);
        if (!st || !st.answers.phone) return NextResponse.json({ ok: true });
        const fullName = `${st.answers.lastName || ""} ${st.answers.firstName || ""}`.trim();

        if (st.mode === "reserve" && st.city) {
          await createReserveCandidate({
            phone: st.answers.phone,
            fullName,
            region: st.region,
            city: st.city,
            branch: st.answers.branch,
            position: st.answers.position,
            shift: st.shift,
            birthDate: st.answers.birthDate,
            gender: st.answers.gender,
            address: st.answers.address,
            experienceYears: st.answers.totalExp,
            education: st.answers.education,
            lastWorkplace: st.answers.lastWork,
            telegramChatId: String(chatId),
            telegramUsername: cq.from?.username ? `@${cq.from.username}` : undefined,
            questionnaireData: st.answers,
          });
        } else if (st.vacancyId) {
          await createApplicationFromLead({
            phone: st.answers.phone,
            fullName,
            vacancyId: st.vacancyId,
            source: "Telegram bot",
            birthDate: st.answers.birthDate,
            gender: st.answers.gender,
            city: st.city,
            address: st.answers.address,
            experienceYears: st.answers.totalExp,
            education: st.answers.education,
            lastWorkplace: st.answers.lastWork,
            telegramChatId: String(chatId),
            telegramUsername: cq.from?.username ? `@${cq.from.username}` : undefined,
            questionnaireData: st.answers,
          });
        }

        sessions.set(chatId, { mode: "apply", step: "idle", answers: {} });
        await sendTelegramMessage(
          String(chatId),
          "✅ Arizangiz muvaffaqiyatli qabul qilindi! Har bir bosqich o'zgarishi haqida shu bot orqali xabar olasiz."
        );
      }
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    if (!msg) return NextResponse.json({ ok: true });
    const chatId = msg.chat.id as number;
    const text = (msg.text || "").trim();

    if (text === "/start") {
      sessions.set(chatId, { mode: "apply", step: "idle", answers: {} });
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "Assalomu alaykum! Rekruting ATS tizimiga xush kelibsiz.\nBo'sh ish o'rinlarini ko'rish uchun tugmani bosing:",
        reply_markup: {
          keyboard: [[{ text: "📋 Bo'sh ish o'rinlari" }, { text: "📄 Ariza holati" }]],
          resize_keyboard: true,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (text === "📋 Bo'sh ish o'rinlari") {
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "Qaysi hududda (yoki Bosh ofis / Ombor) ishlamoqchisiz?",
        reply_markup: {
          inline_keyboard: REGIONS.map((r) => [{ text: `📍 ${r}`, callback_data: `reg:${r}` }]),
        },
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
        const stages = TRACK_CONFIGS[a.track as TrackType]?.stages || [];
        const curIdx = stages.findIndex((s) => s.id === a.current_stage);
        const stLabel = stages[curIdx]?.labelUz || a.current_stage;
        const bar = stages
          .map((_, idx) => (idx <= curIdx ? "🟢" : "⚪"))
          .join(" ");
        return `💼 Bosqich: <b>${stLabel}</b>\n${bar}`;
      });
      await sendTelegramMessage(
        String(chatId),
        lines.length ? lines.join("\n") : "Arizalar topilmadi."
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

    if (st.step === "firstName") {
      st.answers.firstName = text;
      st.step = "lastName";
    } else if (st.step === "lastName") {
      st.answers.lastName = text;
      st.step = "birthDate";
    } else if (st.step === "birthDate") {
      st.answers.birthDate = text;
      st.step = "address";
    } else if (st.step === "address") {
      st.answers.address = text;
      st.step = "phone";
    } else if (st.step === "phone" || msg.contact) {
      st.answers.phone = normalizePhone(msg.contact?.phone_number || text);
      st.step = "gender";
    } else if (st.step === "lastWork") {
      st.answers.lastWork = text;
      st.step = "illness";
    }

    sessions.set(chatId, st);
    await askNextQuestion(token, chatId, st);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
