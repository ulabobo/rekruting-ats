import { Language } from "@/types/ats";

export const UI_TEXT: Record<
  Language,
  {
    appName: string;
    appSubtitle: string;
    directionsGroup: string;
    managementGroup: string;
    vacanciesNav: string;
    allCandidatesNav: string;
    analyticsNav: string;
    sheetsErpNav: string;
    adminSettingsNav: string;
    searchPlaceholder: string;
    addCandidate: string;
    addVacancy: string;
    newStore: string;
    boardView: string;
    tableView: string;
    filters: string;
    allBranches: string;
    allPositions: string;
    allSources: string;
    onlyDuplicates: string;
    onlySlaBreach: string;
    duplicateBadge: string;
    emptyColumn: string;
    matchLabel: string;
    hoursShort: string;
    daysShort: string;
    logout: string;
    loginTitle: string;
    loginSubtitle: string;
    loginLabel: string;
    passwordLabel: string;
    loginButton: string;
    loginError: string;
    // Candidate drawer (simple & clean)
    candidateInfo: string;
    phoneLabel: string;
    addressLabel: string;
    experienceLabel: string;
    educationLabel: string;
    vacancyLabel: string;
    branchLabel: string;
    salaryLabel: string;
    evaluationTitle: string;
    commentPlaceholder: string;
    saveEvaluation: string;
    documentTitle: string;
    uploadPassport: string;
    passportVerified: string;
    hireDateLabel: string;
    sendToLms: string;
    alreadyHired: string;
    rejectCandidate: string;
    historyTitle: string;
    noHistory: string;
    autoBotHint: string;
    // All candidates archive
    allCandidatesTitle: string;
    allCandidatesSubtitle: string;
    statusAll: string;
    statusActive: string;
    statusOffered: string;
    statusHired: string;
    statusRejected: string;
  }
> = {
  uz: {
    appName: "Rekruting ATS",
    appSubtitle: "Xodimlarni tanlash tizimi",
    directionsGroup: "Tanlash yo'nalishlari",
    managementGroup: "Boshqaruv va Tizim",
    vacanciesNav: "Vakansiyalar",
    allCandidatesNav: "Barcha nomzodlar",
    analyticsNav: "Analitika va KPI",
    sheetsErpNav: "Sheets (ERP) va Bot",
    adminSettingsNav: "Admin va Sozlamalar",
    searchPlaceholder: "Ism-familiya, telefon yoki lavozim bo'yicha qidirish...",
    addCandidate: "Nomzod qo'shish",
    addVacancy: "Vakansiya",
    newStore: "Yangi do'kon",
    boardView: "Doska",
    tableView: "Jadval",
    filters: "Filtrlar:",
    allBranches: "Barcha filiallar",
    allPositions: "Barcha lavozimlar",
    allSources: "Barcha manbalar",
    onlyDuplicates: "Qayta murojaatlar",
    onlySlaBreach: "Muddati o'tganlar",
    duplicateBadge: "Qayta murojaat",
    emptyColumn: "Nomzod yo'q",
    matchLabel: "Moslik",
    hoursShort: "soat",
    daysShort: "kun",
    logout: "Chiqish",
    loginTitle: "Rekruting ATS tizimiga kirish",
    loginSubtitle: "Rekruter yoki Admin login va parolini kiriting",
    loginLabel: "Login",
    passwordLabel: "Parol",
    loginButton: "Tizimga kirish",
    loginError: "Login yoki parol noto'g'ri",
    candidateInfo: "Nomzod ma'lumotlari",
    phoneLabel: "Telefon",
    addressLabel: "Manzil",
    experienceLabel: "Tajriba",
    educationLabel: "Ta'lim",
    vacancyLabel: "Lavozim",
    branchLabel: "Filial",
    salaryLabel: "Maosh",
    evaluationTitle: "Baholash va Xulosa",
    commentPlaceholder: "Suhbat yoki qo'ng'iroq bo'yicha qisqa xulosa yozing...",
    saveEvaluation: "Bahoni saqlash",
    documentTitle: "Hujjat va Ishga olish",
    uploadPassport: "Pasport / ID rasmini yuklash",
    passportVerified: "Pasport / ID yuklangan",
    hireDateLabel: "Ishga chiqish sanasi",
    sendToLms: "O'qitishga (LMS) topshirish",
    alreadyHired: "O'qitishga topshirilgan",
    rejectCandidate: "Rad etish",
    historyTitle: "Jarayon tarixi",
    noHistory: "Hozircha o'zgarishlar yo'q",
    autoBotHint:
      "Bosqichni o'zgartirganingizda nomzodga Telegram bot orqali shablon xabari avtomatik yuboriladi.",
    allCandidatesTitle: "Barcha nomzodlar bazasi",
    allCandidatesSubtitle:
      "Qiziqish bildirganlar, jarayondagilar, ishga olinganlar va rad etilganlarning yagona ro'yxati",
    statusAll: "Barchasi",
    statusActive: "Jarayonda",
    statusOffered: "Taklif berilgan",
    statusHired: "Ishga olingan",
    statusRejected: "Rad etilgan",
  },
  ru: {
    appName: "Rekruting ATS",
    appSubtitle: "Система подбора персонала",
    directionsGroup: "Направления подбора",
    managementGroup: "Управление и Система",
    vacanciesNav: "Вакансии",
    allCandidatesNav: "Все кандидаты",
    analyticsNav: "Аналитика и KPI",
    sheetsErpNav: "Sheets (ERP) и Бот",
    adminSettingsNav: "Админ и Настройки",
    searchPlaceholder: "Поиск по ФИО, телефону или должности...",
    addCandidate: "Добавить кандидата",
    addVacancy: "Вакансия",
    newStore: "Новый магазин",
    boardView: "Доска",
    tableView: "Таблица",
    filters: "Фильтры:",
    allBranches: "Все филиалы",
    allPositions: "Все должности",
    allSources: "Все источники",
    onlyDuplicates: "Повторные заявки",
    onlySlaBreach: "Просроченные",
    duplicateBadge: "Повторная заявка",
    emptyColumn: "Нет кандидатов",
    matchLabel: "Совп.",
    hoursShort: "ч",
    daysShort: "дн",
    logout: "Выйти",
    loginTitle: "Вход в систему Rekruting ATS",
    loginSubtitle: "Введите логин и пароль рекрутера или администратора",
    loginLabel: "Логин",
    passwordLabel: "Пароль",
    loginButton: "Войти",
    loginError: "Неверный логин или пароль",
    candidateInfo: "Данные кандидата",
    phoneLabel: "Телефон",
    addressLabel: "Адрес",
    experienceLabel: "Опыт работы",
    educationLabel: "Образование",
    vacancyLabel: "Должность",
    branchLabel: "Филиал",
    salaryLabel: "Зарплата",
    evaluationTitle: "Оценка и Заключение",
    commentPlaceholder: "Напишите краткий комментарий по итогам звонка или интервью...",
    saveEvaluation: "Сохранить оценку",
    documentTitle: "Документы и Прием",
    uploadPassport: "Загрузить фото паспорта / ID",
    passportVerified: "Паспорт / ID загружен",
    hireDateLabel: "Дата выхода на работу",
    sendToLms: "Передать в обучение (LMS)",
    alreadyHired: "Передан в обучение",
    rejectCandidate: "Отклонить",
    historyTitle: "История изменений",
    noHistory: "Изменений пока нет",
    autoBotHint:
      "При смене этапа система автоматически отправит кандидату шаблонное сообщение в Telegram-бот.",
    allCandidatesTitle: "Единая база кандидатов",
    allCandidatesSubtitle:
      "Все откликнувшиеся, в процессе отбора, принятые и отклоненные кандидаты в одном месте",
    statusAll: "Все",
    statusActive: "В процессе",
    statusOffered: "Оффер отправлен",
    statusHired: "Принят",
    statusRejected: "Отклонен",
  },
};
