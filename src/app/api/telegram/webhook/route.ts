import { NextRequest, NextResponse } from "next/server";
import {
  addDocument,
  createApplicationFromLead,
  createReserveCandidate,
  getSupabase,
  normalizePhone,
} from "@/lib/supabase-db";
import { sendTelegramMessage } from "@/lib/telegram";
import { handleOnboardingCallback, handleOnboardingMessage } from "@/lib/onboarding-bot";
import { TRACK_CONFIGS } from "@/lib/stages";
import { TrackType } from "@/types/ats";

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
  | "illnessNote"
  | "photo"
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
  avatarUrl?: string;
  answers: Record<string, string>;
}

const STEP_ORDER: Step[] = [
  "hasExp",
  "firstName",
  "lastName",
  "birthDate",
  "address",
  "phone",
  "gender",
  "marital",
  "student",
  "education",
  "uzLang",
  "ruLang",
  "totalExp",
  "lastWork",
  "illness",
  "photo",
  "consent",
];

function getProgressHeader(step: Step): string {
  const idx = STEP_ORDER.indexOf(step);
  if (idx === -1) return "";
  const pct = Math.min(5, Math.max(1, Math.ceil(((idx + 1) / STEP_ORDER.length) * 5)));
  const bar = "🟩".repeat(pct) + "⬜".repeat(5 - pct);
  const section =
    idx <= 1
      ? "Tajriba"
      : idx <= 8
      ? "Shaxsiy ma'lumotlar"
      : idx <= 13
      ? "Ta'lim va tillar"
      : idx <= 14
      ? "Sog'liq"
      : "Foto va Tasdiqlash";
  return `${bar} <i>${section}</i>\n\n`;
}

async function getSession(chatId: number): Promise<SessionState | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("ats_bot_sessions")
    .select("state")
    .eq("chat_id", String(chatId))
    .maybeSingle();
  return (data?.state as SessionState) || null;
}

async function saveSession(chatId: number, state: SessionState) {
  const sb = getSupabase();
  await sb.from("ats_bot_sessions").upsert(
    {
      chat_id: String(chatId),
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" }
  );
}

async function clearSession(chatId: number) {
  const sb = getSupabase();
  await sb.from("ats_bot_sessions").delete().eq("chat_id", String(chatId));
}

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
  const hdr = getProgressHeader(st.step);
  switch (st.step) {
    case "hasExp":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: `${hdr}Tanlangan lavozim bo'yicha avval ishlaganmisiz?`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Ha, tajribam bor", callback_data: "ans:hasExp:Ha" },
              { text: "❌ Yo'q", callback_data: "ans:hasExp:Yo'q" },
            ],
          ],
        },
      });
    case "firstName":
      return sendTelegramMessage(String(chatId), `${hdr}Ismingizni kiriting:`);
    case "lastName":
      return sendTelegramMessage(String(chatId), `${hdr}Familiyangizni kiriting:`);
    case "birthDate":
      return sendTelegramMessage(
        String(chatId),
        `${hdr}Tug'ilgan sanangizni kiriting (masalan: 10.08.2002):`
      );
    case "address":
      return sendTelegramMessage(
        String(chatId),
        `${hdr}Yashash manzilingizni kiriting (tuman, ko'cha, uy):`
      );
    case "phone":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: `${hdr}Telefon raqamingizni yuboring (+998901234567):`,
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    case "gender":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: `${hdr}Jinsingizni tanlang:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👨 Erkak", callback_data: "ans:gender:Erkak" },
              { text: "👩 Ayol", callback_data: "ans:gender:Ayol" },
            ],
          ],
        },
      });
    case "marital": {
      const isMale = st.answers.gender === "Erkak";
      const opts = isMale
        ? ["Uylangan", "Uylanmagan", "Ajrashgan"]
        : ["Turmush qurgan", "Turmush qurmagan", "Ajrashgan"];
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: `${hdr}Oilaviy holatingiz:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: opts.map((opt) => [
            { text: opt, callback_data: `ans:marital:${opt}` },
          ]),
        },
      });
    }
    case "pregnant":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: `${hdr}Homiladormisiz?`,
        parse_mode: "HTML",
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
        text: `${hdr}Hozirda talabamisiz?`,
        parse_mode: "HTML",
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
        text: `${hdr}Ma'lumot darajangiz:`,
        parse_mode: "HTML",
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
        text: `${hdr}O'zbek tili darajangiz:`,
        parse_mode: "HTML",
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
        text: `${hdr}Rus tili darajangiz:`,
        parse_mode: "HTML",
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
        text: `${hdr}Umumiy ish tajribangiz:`,
        parse_mode: "HTML",
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
        `${hdr}Oxirgi ish joyingiz va nima sababdan ketganingizni yozing (agar ishlamagan bo'lsangiz «Yo'q» deb yozing):`
      );
    case "illness":
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: `${hdr}Sog'lig'ingiz bo'yicha og'ir kasallik turi yoki ishga cheklovlar bormi?`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Yo'q, sog'lomman", callback_data: "ans:illness:Yo'q" }],
            [{ text: "⚠️ Ha, bor (izoh qoldiraman)", callback_data: "ans:illness:Ha" }],
          ],
        },
      });
    case "illnessNote":
      return sendTelegramMessage(
        String(chatId),
        `${hdr}Iltimos, sog'lig'ingizdagi kasallik turi yoki cheklov haqida qisqacha izoh yozing:`
      );
    case "photo":
      return sendTelegramMessage(
        String(chatId),
        `${hdr}📸 Iltimos, o'zingizning aniq yuz rasmingizni (selfi yoki 3x4 rasm) yuboring:`
      );
    case "consent": {
      const a = st.answers;
      const summary =
        `📋 <b>To'liq anketangizni tekshiring:</b>\n\n` +
        `📍 <b>Hudud:</b> ${a.region || "—"}\n` +
        `🏢 <b>Filial:</b> ${a.branch || "—"}\n` +
        `💼 <b>Lavozim:</b> ${a.position || "—"}\n` +
        `🕒 <b>Smena:</b> ${a.shift || "—"}\n` +
        `🛠 <b>Lavozimda tajriba:</b> ${a.hasExp || "—"}\n` +
        `👤 <b>F.I.O:</b> ${a.lastName || ""} ${a.firstName || ""}\n` +
        `🎂 <b>Tug'ilgan sana:</b> ${a.birthDate || "—"}\n` +
        `🏠 <b>Manzil:</b> ${a.address || "—"}\n` +
        `📱 <b>Telefon:</b> ${a.phone || "—"}\n` +
        `⚧ <b>Jinsi:</b> ${a.gender || "—"}\n` +
        `💍 <b>Oilaviy holat:</b> ${a.marital || "—"}\n` +
        (a.pregnant ? `🤰 <b>Homiladorlik:</b> ${a.pregnant}\n` : "") +
        `🎓 <b>Talaba:</b> ${a.student || "—"} | <b>Ma'lumot:</b> ${a.education || "—"}\n` +
        `🗣 <b>O'zbek tili:</b> ${a.uzLang || "—"} | <b>Rus tili:</b> ${a.ruLang || "—"}\n` +
        `⏳ <b>Umumiy tajriba:</b> ${a.totalExp || "—"}\n` +
        `🏭 <b>Oxirgi ish joyi:</b> ${a.lastWork || "—"}\n` +
        `🏥 <b>Sog'liq / Cheklov:</b> ${a.illness || "Yo'q"}\n` +
        `📸 <b>Foto:</b> ${st.avatarUrl ? "✅ Yuklandi" : "—"}\n\n` +
        `Ma'lumotlarni tasdiqlab, yuborishga ruxsat berasizmi?`;
      return tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: summary,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Hammasi to'g'ri, yuborish", callback_data: "consent:yes" }],
            [{ text: "❌ Bekor qilish", callback_data: "cancel" }],
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

      if (data.startsWith("onboard:")) {
        await handleOnboardingCallback(token, chatId, msgId, data);
        return NextResponse.json({ ok: true });
      }

      if (data === "cancel") {
        await clearSession(chatId);
        await editOrSend(
          token,
          chatId,
          msgId,
          "❌ Ariza bekor qilindi. Yangidan boshlash uchun «📋 Bo'sh ish o'rinlari» tugmasini bosing."
        );
        return NextResponse.json({ ok: true });
      }

      if (data === "back:reg") {
        const { data: openVacs } = await sb
          .from("ats_vacancies")
          .select("region")
          .in("status", ["open", "accepted"]);
        const regions = Array.from(
          new Set((openVacs || []).map((v) => v.region).filter(Boolean))
        ) as string[];
        await editOrSend(
          token,
          chatId,
          msgId,
          "Qaysi hududda ishlamoqchisiz? Hududni tanlang:",
          {
            inline_keyboard: [
              ...regions.map((r) => [{ text: `📍 ${r}`, callback_data: `reg:${r}` }]),
              [{ text: "🌐 Boshqa hudud (Ariza qoldirish)", callback_data: "reserve:Boshqa hudud" }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 1. Viloyat tanlandi -> To'g'ridan-to'g'ri shu viloyatdagi Filiallar (Bosh ofis) chiqadi!
      if (data.startsWith("reg:")) {
        const region = data.replace("reg:", "");
        const { data: vacs } = await sb
          .from("ats_vacancies")
          .select("*")
          .in("status", ["open", "accepted"])
          .eq("region", region);

        const branches = Array.from(new Set((vacs || []).map((v) => v.branch)));
        const city = vacs?.[0]?.city || region;

        await saveSession(chatId, {
          mode: "apply",
          step: "idle",
          region,
          city,
          answers: { region, city },
        });

        await editOrSend(
          token,
          chatId,
          msgId,
          `📍 Hudud: <b>${region}</b>\nFilialni (yoki Bosh ofisni) tanlang:`,
          {
            inline_keyboard: [
              ...branches.map((b) => [{ text: `🏢 ${b}`, callback_data: `branch:${b}` }]),
              [{ text: "⬅️ Orqaga", callback_data: "back:reg" }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 2. Filial tanlandi -> Lavozimlar
      if (data.startsWith("branch:")) {
        const branch = data.replace("branch:", "");
        const st = (await getSession(chatId)) || {
          mode: "apply",
          step: "idle",
          answers: {},
        };
        st.branch = branch;
        st.answers.branch = branch;
        await saveSession(chatId, st);

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
                {
                  text: `💼 ${v.position} (${v.headcount} ta o'rin)`,
                  callback_data: `vac:${v.id}`,
                },
              ]),
              [{ text: "⬅️ Orqaga", callback_data: `reg:${st.region || ""}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 3. Lavozim tanlandi -> "Sizdan kutamiz" + Smena
      if (data.startsWith("vac:")) {
        const vacId = data.replace("vac:", "");
        const { data: vac } = await sb
          .from("ats_vacancies")
          .select("*")
          .eq("id", vacId)
          .maybeSingle();
        if (!vac) return NextResponse.json({ ok: true });

        const st = (await getSession(chatId)) || {
          mode: "apply",
          step: "idle",
          answers: {},
        };
        st.vacancyId = vac.id;
        st.position = vac.position;
        st.region = vac.region || st.region;
        st.city = vac.city || st.city;
        st.answers.position = vac.position;
        await saveSession(chatId, st);

        const { data: prof } = await sb
          .from("ats_position_profiles")
          .select("expectation_uz")
          .eq("track", vac.track)
          .ilike("position_name", vac.position)
          .maybeSingle();

        const expText =
          prof?.expectation_uz ||
          `✨ <b>${vac.position}</b> lavozimi bo'yicha sizdan mas'uliyat, xushmuomalalik va jamoaviy ishlashni kutamiz!`;

        const { data: setRow } = await sb
          .from("ats_settings")
          .select("data")
          .eq("id", "default")
          .maybeSingle();
        const shifts: string[] = setRow?.data?.shifts?.length ? setRow.data.shifts : SHIFTS;

        await editOrSend(token, chatId, msgId, `${expText}\n\n🕒 Qulay smenani tanlang:`, {
          inline_keyboard: [
            ...shifts.map((s) => [{ text: s, callback_data: `shift:${s}` }]),
            [{ text: "⬅️ Orqaga", callback_data: `branch:${st.branch || vac.branch}` }],
          ],
        });
        return NextResponse.json({ ok: true });
      }

      // 4. Smena tanlandi -> Anketa boshlanadi
      if (data.startsWith("shift:")) {
        const shift = data.replace("shift:", "");
        const st = (await getSession(chatId)) || {
          mode: "apply",
          step: "idle",
          answers: {},
        };
        st.shift = shift;
        st.answers.shift = shift;
        st.step = "hasExp";
        await saveSession(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("reserve:")) {
        const city = data.replace("reserve:", "");
        const st: SessionState = {
          mode: "reserve",
          step: "hasExp",
          region: city,
          city,
          answers: { region: city, city, branch: city, position: "Umumiy ariza" },
        };
        await saveSession(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

      // Inline savollar
      if (data.startsWith("ans:")) {
        const [, field, val] = data.split(":");
        const st = await getSession(chatId);
        if (!st || st.step === "idle") return NextResponse.json({ ok: true });

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
        else if (field === "illness") {
          st.step = val === "Ha" ? "illnessNote" : "photo";
        }

        await saveSession(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

      // Yakuniy tasdiqlash
      if (data === "consent:yes") {
        const st = await getSession(chatId);
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
            avatarUrl: st.avatarUrl,
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
            avatarUrl: st.avatarUrl,
            questionnaireData: st.answers,
          });
        }

        await clearSession(chatId);
        await editOrSend(
          token,
          chatId,
          msgId,
          "✅ Arizangiz muvaffaqiyatli qabul qilindi! Har bir bosqich o'zgarishi haqida shu bot orqali xabar olasiz."
        );
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    if (!msg) return NextResponse.json({ ok: true });
    const chatId = msg.chat.id as number;
    const text = (msg.text || "").trim();

    if (text === "/start") {
      await clearSession(chatId);
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

    if (text !== "📋 Bo'sh ish o'rinlari" && text !== "📄 Ariza holati") {
      const handledOnboarding = await handleOnboardingMessage(token, chatId, msg);
      if (handledOnboarding) {
        return NextResponse.json({ ok: true });
      }
    }

    if (text === "📋 Bo'sh ish o'rinlari") {
      await clearSession(chatId);
      // 6-band: Avvalgi anketa bor-yo'qligini tekshirish
      const { data: existingCand } = await sb
        .from("ats_candidates")
        .select("id, full_name")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();

      if (existingCand) {
        const { data: blApp } = await sb
          .from("ats_applications")
          .select("id")
          .eq("candidate_id", existingCand.id)
          .eq("status", "blacklist")
          .limit(1)
          .maybeSingle();

        if (blApp) {
          await sendTelegramMessage(
            String(chatId),
            "Kechirasiz, sizning arizangiz hozirda tizim tomonidan qabul qilinmaydi."
          );
          return NextResponse.json({ ok: true });
        }

        await sendTelegramMessage(
          String(chatId),
          `ℹ️ <b>${existingCand.full_name}</b>, sizda tizimda avval to'ldirilgan anketa mavjud. Yangi ariza topshirsangiz, ma'lumotlaringiz yangilanadi.`
        );
      }

      const { data: openVacs } = await sb
        .from("ats_vacancies")
        .select("region")
        .in("status", ["open", "accepted"]);
      const regions = Array.from(
        new Set((openVacs || []).map((v) => v.region).filter(Boolean))
      ) as string[];

      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text:
          regions.length > 0
            ? "Qaysi hududda ishlamoqchisiz? Hududni tanlang:"
            : "Hozircha ochiq vakansiyalar mavjud emas, ammo ariza qoldirishingiz mumkin:",
        reply_markup: {
          inline_keyboard: [
            ...regions.map((r) => [{ text: `📍 ${r}`, callback_data: `reg:${r}` }]),
            [{ text: "🌐 Boshqa hudud (Ariza qoldirish)", callback_data: "reserve:Boshqa hudud" }],
          ],
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
        const bar = stages.map((_, idx) => (idx <= curIdx ? "🟢" : "⚪")).join(" ");
        return `💼 Bosqich: <b>${stLabel}</b>\n${bar}`;
      });
      await sendTelegramMessage(
        String(chatId),
        lines.length ? lines.join("\n\n") : "Arizalar topilmadi."
      );
      return NextResponse.json({ ok: true });
    }

    const st = await getSession(chatId);

    // Rasm yuborilganda: agar anketa "photo" qadamida bo'lsa avatar sifatida saqlanadi, aks holda pasport hujjati
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      if (st && st.step === "photo") {
        st.avatarUrl = `/api/telegram/file?file_id=${photo.file_id}`;
        st.step = "consent";
        await saveSession(chatId, st);
        await askNextQuestion(token, chatId, st);
        return NextResponse.json({ ok: true });
      }

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
          await addDocument({
            applicationId: app.id,
            docType: "pasport_id",
            fileName: `tg_passport_${photo.file_id.slice(0, 8)}.jpg`,
            fileUrl: `/api/telegram/file?file_id=${photo.file_id}`,
            actorName: cand.full_name,
          });
          await sendTelegramMessage(String(chatId), "✅ Pasport / ID karta rasmingiz qabul qilindi!");
        }
      }
      return NextResponse.json({ ok: true });
    }

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
    } else if (st.step === "illnessNote") {
      st.answers.illness = `Ha: ${text}`;
      st.step = "photo";
    }

    await saveSession(chatId, st);
    await askNextQuestion(token, chatId, st);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
