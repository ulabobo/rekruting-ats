export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN sozlanmagan." };
  }
  if (!chatId) {
    return { ok: false, error: "Nomzodning Telegram Chat ID si mavjud emas." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
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
