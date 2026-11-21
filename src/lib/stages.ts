import { Language, TrackType } from "@/types/ats";

export interface StageDefinition {
  id: string;
  labelUz: string;
  labelRu: string;
  shortUz: string;
  shortRu: string;
  color: string;
  requiresEvaluation?: boolean;
  requiresPassportForNext?: boolean;
}

export interface TrackConfig {
  id: TrackType;
  titleUz: string;
  titleRu: string;
  subtitleUz: string;
  subtitleRu: string;
  slaLabelUz: string;
  slaLabelRu: string;
  slaDays: number;
  stages: StageDefinition[];
}

export const TRACK_CONFIGS: Record<TrackType, TrackConfig> = {
  dokon_xodimi: {
    id: "dokon_xodimi",
    titleUz: "Do'kon xodimlari",
    titleRu: "Сотрудники магазина",
    subtitleUz: "Sotuvchi, kassir, omborchi",
    subtitleRu: "Продавец, кассир, кладовщик",
    slaLabelUz: "Muddat: ≤ 10 kun",
    slaLabelRu: "Срок: ≤ 10 дней",
    slaDays: 10,
    stages: [
      {
        id: "otklik",
        labelUz: "Qiziqish bildirganlar",
        labelRu: "Отклики",
        shortUz: "Qiziqish",
        shortRu: "Отклик",
        color: "#ef4444",
      },
      {
        id: "call_screen",
        labelUz: "Telefon suhbati",
        labelRu: "Телефонный звонок",
        shortUz: "Qo'ng'iroq",
        shortRu: "Звонок",
        color: "#f59e0b",
        requiresEvaluation: true,
      },
      {
        id: "rahbar_suhbati",
        labelUz: "Rahbar bilan suhbat",
        labelRu: "Собеседование с руководителем",
        shortUz: "Rahbar suhbati",
        shortRu: "Интервью",
        color: "#10b981",
        requiresEvaluation: true,
      },
      {
        id: "test_kuni",
        labelUz: "1 kunlik sinov kuni",
        labelRu: "1-дневный тест-день",
        shortUz: "Sinov kuni",
        shortRu: "Тест-день",
        color: "#8b5cf6",
      },
      {
        id: "offer",
        labelUz: "Ish taklifi (2 kun)",
        labelRu: "Предложение о работе (2 дня)",
        shortUz: "Ish taklifi",
        shortRu: "Оффер",
        color: "#2563eb",
      },
      {
        id: "hujjat_lms",
        labelUz: "Hujjatlar va O'qitish",
        labelRu: "Документы и Обучение",
        shortUz: "Hujjatlar",
        shortRu: "Документы",
        color: "#0f766e",
        requiresPassportForNext: true,
      },
      {
        id: "ishga_qabul",
        labelUz: "Ishga qabul qilindi",
        labelRu: "Принят на работу",
        shortUz: "Qabul qilindi",
        shortRu: "Принят",
        color: "#16a34a",
      },
    ],
  },
  dokon_rahbari: {
    id: "dokon_rahbari",
    titleUz: "Do'kon rahbarlari",
    titleRu: "Руководители магазинов",
    subtitleUz: "Supervayzer, do'kon menejeri, direktor",
    subtitleRu: "Супервайзер, менеджер магазина, директор",
    slaLabelUz: "Muddat: 22–30 kun",
    slaLabelRu: "Срок: 22–30 дней",
    slaDays: 30,
    stages: [
      {
        id: "ichki_nomzod",
        labelUz: "Ichki nomzodlar (5 kun)",
        labelRu: "Внутренние кандидаты (5 дней)",
        shortUz: "Ichki",
        shortRu: "Внутр.",
        color: "#6366f1",
      },
      {
        id: "otklik",
        labelUz: "Tashqi nomzodlar",
        labelRu: "Внешние кандидаты",
        shortUz: "Tashqi",
        shortRu: "Внешн.",
        color: "#ef4444",
      },
      {
        id: "call_screen",
        labelUz: "Telefon suhbati",
        labelRu: "Телефонное интервью",
        shortUz: "Qo'ng'iroq",
        shortRu: "Звонок",
        color: "#f59e0b",
        requiresEvaluation: true,
      },
      {
        id: "rahbar_suhbati",
        labelUz: "Rahbarlar bilan uchrashuv",
        labelRu: "Встреча с руководством",
        shortUz: "Uchrashuv",
        shortRu: "Встреча",
        color: "#10b981",
        requiresEvaluation: true,
      },
      {
        id: "offer",
        labelUz: "Yakuniy xulosa va Taklif",
        labelRu: "Итоговое решение и Оффер",
        shortUz: "Ish taklifi",
        shortRu: "Оффер",
        color: "#2563eb",
      },
      {
        id: "hujjat_lms",
        labelUz: "Hujjatlar va O'qitish",
        labelRu: "Документы и Обучение",
        shortUz: "Hujjatlar",
        shortRu: "Документы",
        color: "#0f766e",
        requiresPassportForNext: true,
      },
      {
        id: "ishga_qabul",
        labelUz: "Ishga qabul qilindi",
        labelRu: "Принят на работу",
        shortUz: "Qabul qilindi",
        shortRu: "Принят",
        color: "#16a34a",
      },
    ],
  },
  ofis_xodimi: {
    id: "ofis_xodimi",
    titleUz: "Ofis xodimlari",
    titleRu: "Офисные сотрудники",
    subtitleUz: "Mutaxassislar va ekspertlar",
    subtitleRu: "Специалисты и эксперты",
    slaLabelUz: "Muddat: 28–30 kun",
    slaLabelRu: "Срок: 28–30 дней",
    slaDays: 30,
    stages: [
      {
        id: "ichki_nomzod",
        labelUz: "Ichki nomzodlar",
        labelRu: "Внутренние кандидаты",
        shortUz: "Ichki",
        shortRu: "Внутр.",
        color: "#6366f1",
      },
      {
        id: "otklik",
        labelUz: "Tashqi nomzodlar",
        labelRu: "Внешние кандидаты",
        shortUz: "Tashqi",
        shortRu: "Внешн.",
        color: "#ef4444",
      },
      {
        id: "call_screen",
        labelUz: "Telefon suhbati",
        labelRu: "Телефонное интервью",
        shortUz: "Qo'ng'iroq",
        shortRu: "Звонок",
        color: "#f59e0b",
        requiresEvaluation: true,
      },
      {
        id: "amaliy_topshiriq",
        labelUz: "Amaliy topshiriq",
        labelRu: "Практическое задание",
        shortUz: "Topshiriq",
        shortRu: "Задание",
        color: "#8b5cf6",
      },
      {
        id: "rahbar_suhbati",
        labelUz: "Bo'lim rahbari suhbati",
        labelRu: "Собеседование с руководителем",
        shortUz: "Suhbat",
        shortRu: "Интервью",
        color: "#10b981",
        requiresEvaluation: true,
      },
      {
        id: "offer",
        labelUz: "Ish taklifi (3 kun)",
        labelRu: "Предложение о работе (3 дня)",
        shortUz: "Ish taklifi",
        shortRu: "Оффер",
        color: "#2563eb",
      },
      {
        id: "hujjat_lms",
        labelUz: "Hujjatlar va IT / O'qitish",
        labelRu: "Документы и IT / Обучение",
        shortUz: "Hujjatlar",
        shortRu: "Документы",
        color: "#0f766e",
        requiresPassportForNext: true,
      },
      {
        id: "ishga_qabul",
        labelUz: "Ishga qabul qilindi",
        labelRu: "Принят на работу",
        shortUz: "Qabul qilindi",
        shortRu: "Принят",
        color: "#16a34a",
      },
    ],
  },
  ommaviy_yollash: {
    id: "ommaviy_yollash",
    titleUz: "Ommaviy yollash",
    titleRu: "Массовый подбор",
    subtitleUz: "Yangi do'kon ochilishi",
    subtitleRu: "Открытие нового магазина",
    slaLabelUz: "Ochilish sanasiga qarab",
    slaLabelRu: "По дате открытия",
    slaDays: 20,
    stages: [
      {
        id: "otklik",
        labelUz: "Qiziqish bildirganlar",
        labelRu: "Отклики",
        shortUz: "Qiziqish",
        shortRu: "Отклик",
        color: "#ef4444",
      },
      {
        id: "call_screen",
        labelUz: "Telefon suhbati",
        labelRu: "Телефонный звонок",
        shortUz: "Qo'ng'iroq",
        shortRu: "Звонок",
        color: "#f59e0b",
        requiresEvaluation: true,
      },
      {
        id: "rahbar_suhbati",
        labelUz: "Guruh / Rahbar suhbati",
        labelRu: "Групповое / Интервью",
        shortUz: "Suhbat",
        shortRu: "Интервью",
        color: "#10b981",
        requiresEvaluation: true,
      },
      {
        id: "offer",
        labelUz: "Ish taklifi",
        labelRu: "Предложение о работе",
        shortUz: "Ish taklifi",
        shortRu: "Оффер",
        color: "#2563eb",
      },
      {
        id: "hujjat_lms",
        labelUz: "Hujjatlar va O'qitish",
        labelRu: "Документы и Обучение",
        shortUz: "Hujjatlar",
        shortRu: "Документы",
        color: "#0f766e",
        requiresPassportForNext: true,
      },
      {
        id: "ishga_qabul",
        labelUz: "Ishga qabul qilindi",
        labelRu: "Принят на работу",
        shortUz: "Qabul qilindi",
        shortRu: "Принят",
        color: "#16a34a",
      },
    ],
  },
};

export function getTrackTitle(track: TrackType, lang: Language): string {
  return lang === "ru" ? TRACK_CONFIGS[track].titleRu : TRACK_CONFIGS[track].titleUz;
}

export function getStageLabel(
  track: TrackType,
  stageId: string,
  lang: Language,
  short = false
): string {
  if (stageId === "rejected") {
    return lang === "ru" ? "Отклонен" : "Rad etilgan";
  }
  const st = TRACK_CONFIGS[track]?.stages.find((s) => s.id === stageId);
  if (!st) return stageId;
  if (short) return lang === "ru" ? st.shortRu : st.shortUz;
  return lang === "ru" ? st.labelRu : st.labelUz;
}

export const EVALUATION_CRITERIA_BY_TRACK: Record<
  TrackType,
  { uz: string; ru: string }[]
> = {
  dokon_xodimi: [
    { uz: "Muloqot va xushmuomalalik", ru: "Коммуникация и вежливость" },
    { uz: "Sotuv / xizmat ko'rsatish tajribasi", ru: "Опыт продаж / сервиса" },
    { uz: "Grafik va smenaga mosligi", ru: "Готовность к графику и сменам" },
    { uz: "Mas'uliyat va intizom", ru: "Ответственность и дисциплина" },
  ],
  dokon_rahbari: [
    { uz: "Jamoani boshqarish (liderlik)", ru: "Управление командой (лидерство)" },
    { uz: "Savdo va ko'rsatkichlar tahlili", ru: "Анализ продаж и показателей" },
    { uz: "Muammolarni hal qilish ko'nikmasi", ru: "Навык решения проблем" },
  ],
  ofis_xodimi: [
    { uz: "Kasbiy bilim va tajriba", ru: "Профессиональные знания" },
    { uz: "Amaliy topshiriq natijasi", ru: "Результат практического задания" },
    { uz: "Jamoa bilan ishlash", ru: "Работа в команде" },
  ],
  ommaviy_yollash: [
    { uz: "Muloqot va tez moslashuv", ru: "Коммуникация и адаптивность" },
    { uz: "Ochilish sanasiga tayyorlik", ru: "Готовность к дате открытия" },
    { uz: "Smena va hududga moslik", ru: "Соответствие смене и району" },
  ],
};
