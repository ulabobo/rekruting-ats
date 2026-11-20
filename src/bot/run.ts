import { Bot, InlineKeyboard, Keyboard } from "grammy";
import fs from "fs";
import path from "path";
import {
  addDocument,
  createApplicationFromLead,
  createReserveCandidate,
  getSupabase,
  normalizePhone,
} from "../lib/supabase-db";
import { TRACK_CONFIGS } from "../lib/stages";
import { TrackType } from "../types/ats";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN topilmadi.");
  process.exit(1);
}

const CITIES = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan"];

interface SessionState {
  mode: "apply" | "reserve";
  step: "idle" | "fullName" | "phone" | "address" | "experience" | "consent";
  vacancyId?: string;
  city?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  experience?: string;
}

const sessions = new Map<number, SessionState>();
const bot = new Bot(token);

const mainMenu = new Keyboard()
  .text("📋 Bo'sh ish o'rinlari")
  .text("📄 Ariza holati")
  .row()
  .text("🪪 Pasport / ID yuborish")
  .resized();

bot.command("start", async (ctx) => {
  sessions.set(ctx.chat.id, { mode: "apply", step: "idle" });
  await ctx.reply(
    `Assalomu alaykum, ${ctx.from?.first_name || "nomzod"}!\n\n` +
      `<b>Rekruting ATS</b> tizimiga xush kelibsiz. Bo'sh ish o'rinlarini ko'rish uchun quyidagi tugmani bosing:`,
    { parse_mode: "HTML", reply_markup: mainMenu }
  );
});

bot.hears("📋 Bo'sh ish o'rinlari", async (ctx) => {
  const kb = new InlineKeyboard();
  CITIES.forEach((c) => kb.text(`📍 ${c}`, `city:${c}`).row());
  await ctx.reply("Qaysi shaharda ishlamoqchisiz? Shaharni tanlang:", {
    reply_markup: kb,
  });
});

bot.callbackQuery(/^city:(.+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const city = ctx.match[1];
  const sb = getSupabase();
  const { data: openVacancies } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("status", "open")
    .ilike("city", city);

  await ctx.answerCallbackQuery();

  if (openVacancies && openVacancies.length > 0) {
    const kb = new InlineKeyboard();
    openVacancies.forEach((v) => {
      kb.text(`${v.position} — ${v.branch}`, `apply:${v.id}`).row();
    });
    await ctx.reply(`📍 <b>${city}</b> shahridagi bo'sh ish o'rinlari:`, {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  } else {
    const kb = new InlineKeyboard().text(
      "📝 Zaxira anketasini to'ldirish",
      `reserve:${city}`
    );
    await ctx.reply(
      `Hozircha <b>${city}</b> shahrida bo'sh ish o'rni mavjud emas.\n\n` +
        `Ammo yangi joy ochilishi bilan sizga birinchilardan bo'lib xabar beramiz! Ungacha zaxira anketasini to'ldirib qo'yishingiz mumkin:`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  }
});

bot.callbackQuery(/^reserve:(.+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const city = ctx.match[1];
  sessions.set(ctx.chat.id, { mode: "reserve", step: "fullName", city });
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `📍 Zaxira anketasi (<b>${city}</b>)\n\n1/4. To'liq ism-familiyangizni (F.I.O) kiriting:`,
    { parse_mode: "HTML" }
  );
});

bot.hears("📄 Ariza holati", async (ctx) => {
  const sb = getSupabase();
  const { data: cand } = await sb
    .from("ats_candidates")
    .select("id")
    .eq("telegram_chat_id", String(ctx.chat.id))
    .maybeSingle();

  if (!cand) {
    await ctx.reply("Siz hali ariza topshirmagansiz.");
    return;
  }

  const { data: apps } = await sb
    .from("ats_applications")
    .select("*")
    .eq("candidate_id", cand.id);

  if (!apps || apps.length === 0) {
    await ctx.reply("Siz zaxira ro'yxatidasiz. Bo'sh o'rin ochilsa xabar beramiz.");
    return;
  }

  const lines = apps.map((a) => {
    const label =
      TRACK_CONFIGS[a.track as TrackType]?.stages.find(
        (s) => s.id === a.current_stage
      )?.labelUz || a.current_stage;
    return `• Bosqich: <b>${label}</b> | Holat: ${a.status}`;
  });
  await ctx.reply(`📋 <b>Arizalaringiz:</b>\n\n${lines.join("\n")}`, {
    parse_mode: "HTML",
  });
});

bot.hears("🪪 Pasport / ID yuborish", async (ctx) => {
  await ctx.reply("Pasport yoki ID kartangizning aniq rasmini yuboring:");
});

bot.callbackQuery(/^apply:(.+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const vacancyId = ctx.match[1];
  const sb = getSupabase();
  const { data: vac } = await sb
    .from("ats_vacancies")
    .select("*")
    .eq("id", vacancyId)
    .maybeSingle();

  if (!vac) {
    await ctx.answerCallbackQuery({ text: "Vakansiya topilmadi." });
    return;
  }
  sessions.set(ctx.chat.id, { mode: "apply", step: "fullName", vacancyId });
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `Tanlangan lavozim: <b>${vac.position}</b> (${vac.branch})\n\n1/5. To'liq ism-familiyangizni (F.I.O) kiriting:`,
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery("consent:yes", async (ctx) => {
  if (!ctx.chat) return;
  const st = sessions.get(ctx.chat.id);
  if (!st || !st.phone || !st.fullName) {
    await ctx.answerCallbackQuery({ text: "Sessiya tugagan, /start bosing." });
    return;
  }

  if (st.mode === "reserve" && st.city) {
    await createReserveCandidate({
      phone: st.phone,
      fullName: st.fullName,
      city: st.city,
      experienceYears: st.experience,
      telegramChatId: String(ctx.chat.id),
      telegramUsername: ctx.from?.username ? `@${ctx.from.username}` : undefined,
    });
    sessions.set(ctx.chat.id, { mode: "apply", step: "idle" });
    await ctx.answerCallbackQuery({ text: "Saqlandi!" });
    await ctx.reply(
      `✅ Ma'lumotlaringiz <b>${st.city}</b> shahri bo'yicha zaxiraga saqlandi! Yangi o'rin ochilishi bilan sizga xabar beramiz.`,
      { parse_mode: "HTML", reply_markup: mainMenu }
    );
    return;
  }

  if (!st.vacancyId) return;
  await createApplicationFromLead({
    phone: st.phone,
    fullName: st.fullName,
    vacancyId: st.vacancyId,
    source: "Telegram bot",
    address: st.address,
    experienceYears: st.experience,
    telegramChatId: String(ctx.chat.id),
    telegramUsername: ctx.from?.username ? `@${ctx.from.username}` : undefined,
  });

  sessions.set(ctx.chat.id, { mode: "apply", step: "idle" });
  await ctx.answerCallbackQuery({ text: "Yuborildi!" });
  await ctx.reply(
    "✅ Arizangiz qabul qilindi! Har bir bosqich o'zgarishi haqida shu bot orqali xabar olasiz.",
    { reply_markup: mainMenu }
  );
});

bot.on("message:contact", async (ctx) => {
  const st = sessions.get(ctx.chat.id);
  if (!st || st.step !== "phone") return;
  st.phone = normalizePhone(ctx.message.contact.phone_number);
  if (st.mode === "reserve") {
    st.step = "experience";
    sessions.set(ctx.chat.id, st);
    await ctx.reply("3/4. Ish tajribangizni yozing:", { reply_markup: mainMenu });
  } else {
    st.step = "address";
    sessions.set(ctx.chat.id, st);
    await ctx.reply("3/5. Yashash manzilingizni kiriting:", { reply_markup: mainMenu });
  }
});

bot.on("message:photo", async (ctx) => {
  const sb = getSupabase();
  const { data: cand } = await sb
    .from("ats_candidates")
    .select("id, full_name")
    .eq("telegram_chat_id", String(ctx.chat.id))
    .maybeSingle();

  if (!cand) {
    await ctx.reply("Avval vakansiyaga ariza topshiring.");
    return;
  }
  const { data: app } = await sb
    .from("ats_applications")
    .select("id")
    .eq("candidate_id", cand.id)
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app) return;

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  await addDocument({
    applicationId: app.id,
    docType: "pasport_id",
    fileName: `tg_passport_${photo.file_id.slice(0, 8)}.jpg`,
    fileUrl: `telegram://file/${photo.file_id}`,
    actorName: cand.full_name,
  });

  await ctx.reply("✅ Pasport / ID karta rasmingiz qabul qilindi!", {
    reply_markup: mainMenu,
  });
});

bot.on("message:text", async (ctx) => {
  const st = sessions.get(ctx.chat.id);
  if (!st || st.step === "idle") return;
  const text = ctx.message.text.trim();

  if (st.step === "fullName") {
    st.fullName = text;
    st.step = "phone";
    sessions.set(ctx.chat.id, st);
    const phoneKb = new Keyboard()
      .requestContact("📱 Telefon raqamni yuborish")
      .resized()
      .oneTime();
    await ctx.reply("2. Telefon raqamingizni yuboring (+998901234567):", {
      reply_markup: phoneKb,
    });
  } else if (st.step === "phone") {
    st.phone = normalizePhone(text);
    if (st.mode === "reserve") {
      st.step = "experience";
      sessions.set(ctx.chat.id, st);
      await ctx.reply("3/4. Ish tajribangizni yozing:", { reply_markup: mainMenu });
    } else {
      st.step = "address";
      sessions.set(ctx.chat.id, st);
      await ctx.reply("3/5. Yashash manzilingizni kiriting:", { reply_markup: mainMenu });
    }
  } else if (st.step === "address") {
    st.address = text;
    st.step = "experience";
    sessions.set(ctx.chat.id, st);
    await ctx.reply("4/5. Ish tajribangizni yozing:");
  } else if (st.step === "experience") {
    st.experience = text;
    st.step = "consent";
    sessions.set(ctx.chat.id, st);
    const kb = new InlineKeyboard().text("✅ Roziman, yuborish", "consent:yes");
    await ctx.reply("Ma'lumotlarni qayta ishlashga rozimisiz?", {
      reply_markup: kb,
    });
  }
});

console.log("🤖 Aura ATS Telegram Bot (Ssenariy-1 + Supabase) ishga tushmoqda...");
bot.start();
