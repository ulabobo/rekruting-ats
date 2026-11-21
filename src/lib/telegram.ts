import { OnboardingFolderItem, SurveyQuestionItem } from "@/types/ats";

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan." };
  }
  if (!chatId) {
    return { ok: false, error: "Nomzodning Telegram Chat ID si mavjud emas." };
  }

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description || "Telegram API xatosi" };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Tarmoq xatosi",
    };
  }
}

export function buildTemplateMessage(params: {
  template: "offer" | "test_day" | "practical_task" | "welcome_book" | "reject";
  candidateName: string;
  position: string;
  branch: string;
  extraNote?: string;
}): string {
  switch (params.template) {
    case "offer":
      return (
        `🎉 <b>Tabriklaymiz, ${params.candidateName}!</b>\n\n` +
        `Siz Aura kompaniyasining <b>${params.branch}</b> filialidagi <b>${params.position}</b> lavozimiga muvaffaqiyatli tanlandingiz!\n` +
        `${params.extraNote ? `\n📋 Qo'shimcha ma'lumot: ${params.extraNote}\n` : ""}` +
        `\nIltimos, taklifga roziligingizni tasdiqlang va pasport/ID kartangiz rasmini ushbu botga yuboring.`
      );
    case "test_day":
      return (
        `📅 <b>1 kunlik test kuniga taklif</b>\n\n` +
        `Hurmatli ${params.candidateName}, sizni <b>${params.branch}</b> filialida <b>${params.position}</b> lavozimi bo'yicha 1 kunlik test kuniga taklif qilamiz.\n` +
        `${params.extraNote ? `🕒 Vaqt / Manzil: ${params.extraNote}` : ""}`
      );
    case "practical_task":
      return (
        `📝 <b>Amaliy topshiriq (Ofis tanlovi)</b>\n\n` +
        `Hurmatli ${params.candidateName}, <b>${params.position}</b> lavozimi bo'yicha keyingi bosqichga o'tdingiz!\n` +
        `${params.extraNote ? `\nTopshiriq: ${params.extraNote}\n` : ""}` +
        `\nNatijani ushbu botga yuborishingiz mumkin.`
      );
    case "welcome_book":
      return (
        `📚 <b>1-kun qoidasi va Mini Welcome Book</b>\n\n` +
        `Xush kelibsiz, ${params.candidateName}! Aura jamoasiga qo'shilganingiz bilan tabriklaymiz.\n` +
        `• Ishga kelish vaqti: smenadan 15 daqiqa oldin\n` +
        `• Dress-kod: toza va tartibli ko'rinish\n` +
        `• Birinchi kunda do'kon menejeri sizni kutib oladi va LMS o'quv rejasini ochib beradi.`
      );
    case "reject":
      return (
        `Hurmatli ${params.candidateName},\n\n` +
        `Aura kompaniyasining <b>${params.position}</b> lavozimiga qiziqish bildirganingiz uchun katta rahmat! ` +
        `Hozirgi bosqichda boshqa nomzod bilan davom etishga qaror qildik. Sizning ma'lumotlaringiz kadrlar zaxiramizda saqlanadi.`
      );
  }
}

export async function sendTelegramPhoto(
  chatId: string,
  photo: string,
  caption?: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !chatId) return { ok: false, error: "Token yoki Chat ID yo'q" };

  try {
    if (photo.startsWith("data:image/")) {
      const [header, b64] = photo.split(",");
      const mimeMatch = header.match(/data:(image\/[a-zA-Z0-9+.-]+);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const ext = mime.split("/")[1] || "jpg";
      const bytes = Buffer.from(b64, "base64");
      const form = new FormData();
      form.append("chat_id", chatId);
      if (caption) {
        form.append("caption", caption.slice(0, 1024));
        form.append("parse_mode", "HTML");
      }
      form.append("photo", new Blob([bytes], { type: mime }), `standard.${ext}`);
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const d = await res.json();
      return d.ok ? { ok: true } : { ok: false, error: d.description };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption: caption ? caption.slice(0, 1024) : undefined,
        parse_mode: "HTML",
      }),
    });
    const d = await res.json();
    return d.ok ? { ok: true } : { ok: false, error: d.description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Photo xatosi" };
  }
}

export const DEFAULT_SURVEY_ITEMS: SurveyQuestionItem[] = [
  {
    id: "q1",
    question: "1. Jamoadagi muhit va hamkasblarning munosabati sizga qanday taassurot qoldirdi? (1-5 ball)",
    type: "rating",
  },
  {
    id: "q2",
    question: "2. Lavozim vazifalari va ish jarayoni sizga tushunarli bo'ldimi? (1-5 ball)",
    type: "rating",
  },
  {
    id: "q3",
    question: "3. Ish joyi sharoitlari (tozalik, qulaylik, tartib)ni qanday baholaysiz? (1-5 ball)",
    type: "rating",
  },
  {
    id: "q4",
    question: "4. Sinov kuni bo'yicha o'z fikr va takliflaringizni yozib qoldiring:",
    type: "text",
  },
];

export const DEFAULT_ONBOARDING_FOLDERS: OnboardingFolderItem[] = [
  {
    id: "welcome_book",
    title: "Welcome Book",
    description:
      "Aura kompaniyasiga xush kelibsiz! Bizning maqsadimiz — mijozlarga yuqori darajada xizmat ko'rsatish va ahil jamoa bo'lib ishlash. Birinchi kundan boshlab do'kon menejeri sizga LMS o'quv dasturini ochib beradi.",
    images: [],
    enabled: true,
  },
  {
    id: "dress_code",
    title: "Tashqi ko'rinish standarti",
    description:
      "• Toza va dazmollangan kompaniya formasi / klassik uslub.\n• Soch va tirnoqlar tartibli bo'lishi shart.\n• Kuchli atir va ortiqcha taqinchoqlarsiz, ozoda ko'rinish.",
    images: [],
    enabled: true,
  },
  {
    id: "work_hours",
    title: "Ish vaqti va unga rioya qilish",
    description:
      "• Smena boshlanishidan kamida 15 daqiqa oldin do'konda bo'lish.\n• Tushlik va tanaffuslar belgilangan jadval asosida.\n• Kechikish yoki sababli holatlar haqida rahbarni oldindan ogohlantirish.",
    images: [],
    enabled: true,
  },
  {
    id: "store_conduct",
    title: "Ichki standart (zalda o'zini tutish)",
    description:
      "• Savdo zalida telefon ishlatmaslik.\n• Har bir mijozni tabassum bilan kutib olish va yordam taklif qilish.\n• Javonlar tozaligi va mahsulotlar tartibini doimiy nazorat qilish.",
    images: [],
    enabled: true,
  },
];

export const DEFAULT_TEST_DAY_SURVEY: string[] = DEFAULT_SURVEY_ITEMS.map((i) => i.question);

export const DEFAULT_WELCOME_BOOK_TEXT =
  `📖 <b>Mini Welcome Book va Kompaniya Standartlari</b>\n\n` +
  `• <b>Ish vaqti:</b> Smenadan 15 daqiqa oldin do'konda bo'lish shart.\n` +
  `• <b>Dress-kod:</b> Kompaniya standartiga mos toza va tartibli kiyinish.\n` +
  `• <b>Mijozlarga xizmat:</b> Har bir mijozni tabassum va xushmuomalalik bilan kutib olish.\n` +
  `• <b>O'qitish (LMS):</b> Birinchi kunda do'kon menejeri sizga o'quv materiallarini ochib beradi.`;
