"use client";

import React, { useState } from "react";
import { Bot, ClipboardList, Plus, Shield, Trash2, Users } from "lucide-react";
import { AtsDatabase, Language, TrackType } from "@/types/ats";
import { TRACK_CONFIGS, getTrackTitle } from "@/lib/stages";

export default function AdminSettingsPanel({
  db,
  lang,
  onUpdateDb,
}: {
  db: AtsDatabase;
  lang: Language;
  onUpdateDb: (db: AtsDatabase) => void;
}) {
  const [tab, setTab] = useState<"templates" | "profiles" | "users" | "rules">("templates");
  const [msg, setMsg] = useState<string | null>(null);

  // Position profile form
  const [profTrack, setProfTrack] = useState<TrackType>("dokon_xodimi");
  const [profPosition, setProfPosition] = useState("");
  const [profExpectationUz, setProfExpectationUz] = useState("");
  const [profExpectationRu, setProfExpectationRu] = useState("");
  const [profCriteria, setProfCriteria] = useState<{ uz: string; ru: string }[]>([
    { uz: "Muloqot va xushmuomalalik", ru: "Коммуникация и вежливость" },
    { uz: "Mas'uliyat va intizom", ru: "Ответственность и дисциплина" },
  ]);

  // Template form
  const [tplTrack, setTplTrack] = useState<TrackType>("dokon_xodimi");
  const [tplStage, setTplStage] = useState<string>("call_screen");
  const existingTpl = db.messageTemplates.find(
    (t) => t.track === tplTrack && t.stage === tplStage
  );
  const [tplEnabled, setTplEnabled] = useState(existingTpl?.enabled ?? true);
  const [tplUz, setTplUz] = useState(
    existingTpl?.templateUz ||
      "Assalomu alaykum, {ism}! Siz {filial} filialidagi {lavozim} lavozimi bo'yicha keyingi bosqichga o'tdingiz."
  );
  const [tplRu, setTplRu] = useState(
    existingTpl?.templateRu ||
      "Здравствуйте, {ism}! Вы перешли на следующий этап на должность {lavozim} в филиале {filial}."
  );

  // New user form
  const [uLogin, setULogin] = useState("");
  const [uPass, setUPass] = useState("");
  const [uName, setUName] = useState("");
  const [uPos, setUPos] = useState("Rekruter");
  const [uTracks, setUTracks] = useState<TrackType[]>([
    "dokon_xodimi",
    "ommaviy_yollash",
  ]);

  const handleSelectTrackStage = (tr: TrackType, st: string) => {
    setTplTrack(tr);
    setTplStage(st);
    const found = db.messageTemplates.find((t) => t.track === tr && t.stage === st);
    setTplEnabled(found?.enabled ?? true);
    setTplUz(
      found?.templateUz ||
        "Assalomu alaykum, {ism}! Siz {filial} filialidagi {lavozim} lavozimi bo'yicha keyingi bosqichga o'tdingiz."
    );
    setTplRu(
      found?.templateRu ||
        "Здравствуйте, {ism}! Вы перешли на следующий этап на должность {lavozim} в филиале {filial}."
    );
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/ats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_template",
        track: tplTrack,
        stage: tplStage,
        enabled: tplEnabled,
        templateUz: tplUz,
        templateRu: tplRu,
      }),
    });
    const data = await res.json();
    if (data.db) {
      onUpdateDb(data.db);
      setMsg(lang === "ru" ? "Шаблон сохранён!" : "Shablon saqlandi!");
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/ats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_user",
        login: uLogin,
        password: uPass,
        fullName: uName,
        position: uPos,
        role: "recruiter",
        allowedTracks: uTracks,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
    } else {
      onUpdateDb(data.db);
      setULogin("");
      setUPass("");
      setUName("");
      setMsg(lang === "ru" ? "Рекрутер добавлен!" : "Yangi rekruter qo'shildi!");
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {lang === "ru" ? "Админ и Настройки" : "Admin va Sozlamalar"}
          </h2>
          <p className="text-xs text-slate-500">
            {lang === "ru"
              ? "Шаблоны Telegram-бота, доступы рекрутеров и правила системы"
              : "Telegram bot shablonlari, rekruterlar login-parollari va tizim qoidalari"}
          </p>
        </div>

        <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1 text-xs font-semibold">
          <button
            onClick={() => setTab("templates")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
              tab === "templates" ? "bg-teal-700 text-white" : "text-slate-600"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            {lang === "ru" ? "Шаблоны бота" : "Bot shablonlari"}
          </button>
          <button
            onClick={() => setTab("profiles")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
              tab === "profiles" ? "bg-teal-700 text-white" : "text-slate-600"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {lang === "ru" ? "Профили должностей" : "Lavozim profillari"}
          </button>
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
              tab === "users" ? "bg-teal-700 text-white" : "text-slate-600"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {lang === "ru" ? "Рекрутеры (Доступ)" : "Rekruterlar (Dostup)"}
          </button>
          <button
            onClick={() => setTab("rules")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
              tab === "rules" ? "bg-teal-700 text-white" : "text-slate-600"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            {lang === "ru" ? "Правила" : "Qoidalar"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
          {msg}
        </div>
      )}

      {tab === "templates" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleSaveTemplate}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7"
          >
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "ru"
                ? "Создать / изменить шаблон сообщения"
                : "Bosqich uchun avtomatik xabar shabloni"}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  {lang === "ru" ? "Тип вакансии" : "Vakansiya turi"}
                </label>
                <select
                  value={tplTrack}
                  onChange={(e) => {
                    const tr = e.target.value as TrackType;
                    handleSelectTrackStage(tr, TRACK_CONFIGS[tr].stages[0].id);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => (
                    <option key={tr} value={tr}>
                      {getTrackTitle(tr, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  {lang === "ru" ? "Этап" : "Bosqich"}
                </label>
                <select
                  value={tplStage}
                  onChange={(e) => handleSelectTrackStage(tplTrack, e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {TRACK_CONFIGS[tplTrack].stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {lang === "ru" ? st.labelRu : st.labelUz}
                    </option>
                  ))}
                  <option value="rejected">
                    {lang === "ru" ? "Отклонен (Отказ)" : "Rad etilgan (Otkaz)"}
                  </option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={tplEnabled}
                onChange={(e) => setTplEnabled(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              {lang === "ru"
                ? "Автоматически отправлять в Telegram при переходе на этот этап"
                : "Shu bosqichga o'tganda Telegram botdan avtomatik yuborilsin"}
            </label>

            <div className="text-xs">
              <label className="mb-1 block font-semibold text-slate-700">
                Matn (O&apos;zbekcha) — o&apos;zgaruvchilar: {"{ism}"}, {"{lavozim}"},{" "}
                {"{filial}"}, {"{maosh}"}
              </label>
              <textarea
                rows={3}
                value={tplUz}
                onChange={(e) => setTplUz(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </div>

            <div className="text-xs">
              <label className="mb-1 block font-semibold text-slate-700">
                Текст (Русский) — переменные: {"{ism}"}, {"{lavozim}"}, {"{filial}"},{" "}
                {"{maosh}"}
              </label>
              <textarea
                rows={3}
                value={tplRu}
                onChange={(e) => setTplRu(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              {lang === "ru" ? "Сохранить шаблон" : "Shablonni saqlash"}
            </button>
          </form>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "ru" ? "Активные шаблоны" : "Saqlangan shablonlar"}
            </h3>
            {db.messageTemplates.map((t) => (
              <div
                key={t.id}
                onClick={() => handleSelectTrackStage(t.track, t.stage)}
                className="cursor-pointer rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs hover:border-blue-300"
              >
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {getTrackTitle(t.track, lang)} → {t.stage}
                  </span>
                  <span className={t.enabled ? "text-emerald-600" : "text-slate-400"}>
                    {t.enabled ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                  {lang === "ru" ? t.templateRu : t.templateUz}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "profiles" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!profPosition.trim()) return;
              const res = await fetch("/api/ats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "save_position_profile",
                  track: profTrack,
                  positionName: profPosition,
                  expectationUz: profExpectationUz,
                  expectationRu: profExpectationRu,
                  criteria: profCriteria.filter((c) => c.uz.trim()),
                }),
              });
              const data = await res.json();
              if (data.db) {
                onUpdateDb(data.db);
                setProfPosition("");
                setProfExpectationUz("");
                setProfExpectationRu("");
                setMsg(lang === "ru" ? "Профиль сохранён!" : "Lavozim profili saqlandi!");
                setTimeout(() => setMsg(null), 3000);
              }
            }}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-xs lg:col-span-6"
          >
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "ru"
                ? "Критерии оценки по должности"
                : "Lavozim bo'yicha baholash mezonlari"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  {lang === "ru" ? "Направление" : "Yo'nalish"}
                </label>
                <select
                  value={profTrack}
                  onChange={(e) => setProfTrack(e.target.value as TrackType)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => (
                    <option key={tr} value={tr}>
                      {getTrackTitle(tr, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  {lang === "ru" ? "Название должности" : "Lavozim nomi"}
                </label>
                <input
                  required
                  value={profPosition}
                  onChange={(e) => setProfPosition(e.target.value)}
                  placeholder={lang === "ru" ? "Например: Кассир" : "Masalan: Kassir"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">
                {lang === "ru"
                  ? "Текст «Мы ждём от вас» (показывается в Telegram-боте после выбора должности)"
                  : "«Sizdan kutamiz» matni (Telegram botda lavozim tanlangandan keyin chiqadi)"}
              </label>
              <textarea
                rows={2}
                value={profExpectationUz}
                onChange={(e) => setProfExpectationUz(e.target.value)}
                placeholder="Sizdan kutamiz: xushmuomalalik, mas'uliyat, mijozlar bilan ishlash..."
                className="w-full rounded-xl border border-slate-200 p-2.5"
              />
              <textarea
                rows={2}
                value={profExpectationRu}
                onChange={(e) => setProfExpectationRu(e.target.value)}
                placeholder="Мы ждём от вас: вежливость, ответственность..."
                className="w-full rounded-xl border border-slate-200 p-2.5"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  {lang === "ru" ? "Критерии (UZ / RU):" : "Baholash mezonlari (UZ / RU):"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setProfCriteria((p) => [...p, { uz: "", ru: "" }])
                  }
                  className="inline-flex items-center gap-1 font-semibold text-teal-700"
                >
                  <Plus className="h-3.5 w-3.5" /> {lang === "ru" ? "Добавить" : "Mezon qo'shish"}
                </button>
              </div>

              {profCriteria.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    required
                    value={c.uz}
                    onChange={(e) => {
                      const next = [...profCriteria];
                      next[idx].uz = e.target.value;
                      setProfCriteria(next);
                    }}
                    placeholder="O'zbekcha mezon"
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5"
                  />
                  <input
                    required
                    value={c.ru}
                    onChange={(e) => {
                      const next = [...profCriteria];
                      next[idx].ru = e.target.value;
                      setProfCriteria(next);
                    }}
                    placeholder="Критерий на русском"
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setProfCriteria((p) => p.filter((_, i) => i !== idx))
                    }
                    className="text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-5 py-2.5 font-bold text-white hover:bg-teal-800"
            >
              {lang === "ru" ? "Сохранить профиль" : "Profilni saqlash"}
            </button>
          </form>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-6">
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "ru" ? "Сохранённые профили" : "Saqlangan lavozim profillari"}
            </h3>
            {db.positionProfiles.length === 0 ? (
              <p className="text-xs text-slate-400">
                {lang === "ru"
                  ? "Профили пока не добавлены (используются стандартные критерии)."
                  : "Hozircha alohida lavozim profillari kiritilmagan."}
              </p>
            ) : (
              db.positionProfiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {p.positionName}{" "}
                      <span className="ml-1 text-[11px] font-normal text-slate-500">
                        ({getTrackTitle(p.track, lang)})
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {p.criteria.map((c) => (lang === "ru" ? c.ru : c.uz)).join(" • ")}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/ats", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "delete_position_profile",
                          profileId: p.id,
                        }),
                      });
                      const data = await res.json();
                      if (data.db) onUpdateDb(data.db);
                    }}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleCreateUser}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-xs lg:col-span-5"
          >
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Plus className="h-4 w-4 text-blue-600" />
              {lang === "ru" ? "Добавить рекрутера" : "Yangi rekruter qo'shish"}
            </h3>
            <input
              required
              value={uName}
              onChange={(e) => setUName(e.target.value)}
              placeholder={lang === "ru" ? "ФИО" : "Ism-familiya"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                value={uLogin}
                onChange={(e) => setULogin(e.target.value)}
                placeholder="Login"
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
              <input
                required
                value={uPass}
                onChange={(e) => setUPass(e.target.value)}
                placeholder={lang === "ru" ? "Пароль" : "Parol"}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <input
              value={uPos}
              onChange={(e) => setUPos(e.target.value)}
              placeholder={lang === "ru" ? "Должность" : "Lavozim"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />

            <div>
              <p className="mb-1.5 font-semibold text-slate-700">
                {lang === "ru" ? "Доступные разделы:" : "Ochiladigan bo'limlar:"}
              </p>
              <div className="space-y-1.5">
                {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => (
                  <label key={tr} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={uTracks.includes(tr)}
                      onChange={(e) => {
                        if (e.target.checked) setUTracks((p) => [...p, tr]);
                        else setUTracks((p) => p.filter((x) => x !== tr));
                      }}
                    />
                    <span>{getTrackTitle(tr, lang)}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700"
            >
              {lang === "ru" ? "Создать доступ" : "Rekruter yaratish"}
            </button>
          </form>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "ru" ? "Список пользователей" : "Tizim foydalanuvchilari"}
            </h3>
            {db.users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {u.fullName}{" "}
                    <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                      {u.login}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {u.position} •{" "}
                    {u.allowedTracks.map((tr) => getTrackTitle(tr, lang)).join(", ")}
                  </p>
                </div>
                {u.id !== "u-admin" && (
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/ats", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "delete_user", userId: u.id }),
                      });
                      const data = await res.json();
                      if (data.db) onUpdateDb(data.db);
                    }}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold">
                {lang === "ru" ? "Мин. категория внутр. канд." : "Ichki nomzod min. toifasi"}
              </label>
              <input
                value={db.settings.internalCandidateMinCategory}
                onChange={(e) =>
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      internalCandidateMinCategory: e.target.value,
                    },
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold">
                {lang === "ru" ? "Срок внутр. отбора (дн)" : "Ichki tanlov muddati (kun)"}
              </label>
              <input
                type="number"
                value={db.settings.internalSelectionDays}
                onChange={(e) =>
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      internalSelectionDays: Number(e.target.value),
                    },
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block font-semibold">
                {lang === "ru"
                  ? "Смены в Telegram-боте (через запятую)"
                  : "Telegram botdagi smenalar (vergul bilan ajratib yozing)"}
              </label>
              <input
                value={(
                  db.settings.shifts || [
                    "1-smena (09:00–18:00)",
                    "2-smena (14:00–23:00)",
                    "2/2 smena",
                    "To'liq kun (5/2)",
                  ]
                ).join(", ")}
                onChange={(e) =>
                  onUpdateDb({
                    ...db,
                    settings: {
                      ...db.settings,
                      shifts: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await fetch("/api/ats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "update_settings",
                  settings: db.settings,
                }),
              });
              const data = await res.json();
              if (data.db) {
                onUpdateDb(data.db);
                setMsg(lang === "ru" ? "Сохранено!" : "Saqlandi!");
              }
            }}
            className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white"
          >
            {lang === "ru" ? "Сохранить" : "Saqlash"}
          </button>
        </div>
      )}
    </div>
  );
}
