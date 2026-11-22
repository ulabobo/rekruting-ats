"use client";

import React, { useState } from "react";
import { Bot, ClipboardList, Folder, ImagePlus, Plus, Shield, Trash2, Users, X } from "lucide-react";
import {
  AtsDatabase,
  Language,
  OnboardingFolderItem,
  SurveyQuestionItem,
  TrackType,
  User,
} from "@/types/ats";
import { TRACK_CONFIGS, getTrackTitle } from "@/lib/stages";
import { DEFAULT_ONBOARDING_FOLDERS, DEFAULT_SURVEY_ITEMS } from "@/lib/telegram";

export default function AdminSettingsPanel({
  db,
  currentUser,
  lang,
  onUpdateDb,
}: {
  db: AtsDatabase;
  currentUser: User;
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
  const [uEmail, setUEmail] = useState("");
  const [uPos, setUPos] = useState("Rekruter");
  const [uRole, setURole] = useState<"admin" | "recruiter">("recruiter");
  const [uTracks, setUTracks] = useState<TrackType[]>([
    "dokon_xodimi",
    "ommaviy_yollash",
  ]);
  const [uBranches, setUBranches] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<
    "welcome_book" | "dress_code" | "work_hours" | "store_conduct" | "survey" | null
  >(null);

  const allBranches = Array.from(
    new Set([
      "Aura-1",
      "Aura-2",
      "Aura-3",
      "Aura-4",
      "Bosh ofis",
      "Toshkent ombor",
      ...db.vacancies.map((v) => v.branch).filter(Boolean),
    ])
  );

  const handleSelectTrackStage = (tr: TrackType, st: string) => {
    setTplTrack(tr);
    setTplStage(st);
    const found = db.messageTemplates.find((t) => t.track === tr && t.stage === st);
    setTplEnabled(found?.enabled ?? true);
    const defaultUz =
      st === "missed_call"
        ? "Assalomu alaykum, {ism}! Biz sizga {filial} filialidagi {lavozim} lavozimi bo'yicha qo'ng'iroq qildik, ammo bog'lana olmadik. Qulay vaqtda shu botga yozing yoki qayta qo'ng'irog'imizni kuting."
        : "Assalomu alaykum, {ism}! Siz {filial} filialidagi {lavozim} lavozimi bo'yicha keyingi bosqichga o'tdingiz.";
    const defaultRu =
      st === "missed_call"
        ? "Здравствуйте, {ism}! Мы звонили вам по поводу вакансии {lavozim} в филиале {filial}, но не смогли дозвониться. Напишите нам в этот бот в удобное время."
        : "Здравствуйте, {ism}! Вы перешли на следующий этап на должность {lavozim} в филиале {filial}.";
    setTplUz(found?.templateUz || defaultUz);
    setTplRu(found?.templateRu || defaultRu);
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
        email: uEmail,
        position: uPos,
        role: uRole,
        allowedTracks: uTracks,
        assignedBranches: uBranches,
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
      setUEmail("");
      setUBranches([]);
      setMsg(lang === "ru" ? "Рекрутер добавлен!" : "Yangi rekruter qo'shildi!");
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleSaveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await fetch("/api/ats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_user",
        userId: editingUser.id,
        fullName: editingUser.fullName,
        login: editingUser.login,
        password: editingUser.password,
        email: editingUser.email || "",
        position: editingUser.position,
        role: editingUser.role,
        allowedTracks: editingUser.allowedTracks,
        assignedBranches: editingUser.assignedBranches || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Xatolik");
    } else {
      onUpdateDb(data.db);
      setEditingUser(null);
      setMsg(lang === "ru" ? "Профиль обновлен!" : "Profil yangilandi!");
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
          {currentUser.role === "admin" && (
            <button
              onClick={() => setTab("users")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                tab === "users" ? "bg-teal-700 text-white" : "text-slate-600"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              {lang === "ru" ? "Рекрутеры (Доступ)" : "Rekruterlar (Dostup)"}
            </button>
          )}
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
                  <option value="missed_call">
                    {lang === "ru" ? "📞 Не ответил на звонок" : "📞 Telefonni ko'tarmadi"}
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
                {"{filial}"}, {"{maosh}"}, {"{smena}"}
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

      {tab === "users" && currentUser.role === "admin" && (
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
            <div className="grid grid-cols-2 gap-2">
              <input
                value={uPos}
                onChange={(e) => setUPos(e.target.value)}
                placeholder={lang === "ru" ? "Должность" : "Lavozim"}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
              <select
                value={uRole}
                onChange={(e) => setURole(e.target.value as "admin" | "recruiter")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="recruiter">Rekruter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <input
              type="email"
              value={uEmail}
              onChange={(e) => setUEmail(e.target.value)}
              placeholder="Email (ixtiyoriy)"
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

            <div>
              <p className="mb-1.5 font-semibold text-slate-700">
                {lang === "ru" ? "Привязанные филиалы (пусто = все):" : "Biriktirilgan filiallar (bo'sh = barchasi):"}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {allBranches.map((br) => (
                  <label key={br} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={uBranches.includes(br)}
                      onChange={(e) => {
                        if (e.target.checked) setUBranches((p) => [...p, br]);
                        else setUBranches((p) => p.filter((x) => x !== br));
                      }}
                    />
                    <span className="truncate">{br}</span>
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
              {lang === "ru" ? "Список пользователей (нажмите для профиля)" : "Tizim foydalanuvchilari (profil uchun bosing)"}
            </h3>
            {db.users.map((u) => (
              <div
                key={u.id}
                onClick={() => setEditingUser({ ...u, assignedBranches: u.assignedBranches || [] })}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {u.fullName}{" "}
                    <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                      {u.login}
                    </span>
                    <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                      {u.role}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {u.position} • Parol: <span className="font-mono font-semibold text-slate-700">{u.password || "—"}</span>
                    {u.assignedBranches && u.assignedBranches.length > 0
                      ? ` • Filiallar: ${u.assignedBranches.join(", ")}`
                      : " • Barcha filiallar"}
                  </p>
                </div>
                {u.id !== "u-admin" && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
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

          {editingUser && (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setEditingUser(null);
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
            >
              <form
                onSubmit={handleSaveUserProfile}
                className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-xs shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingUser.fullName}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {lang === "ru" ? "Профиль пользователя и доступы" : "Foydalanuvchi profili va ruxsatlari"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">F.I.O</label>
                    <input
                      required
                      value={editingUser.fullName}
                      onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">Lavozim</label>
                    <input
                      value={editingUser.position}
                      onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">Login</label>
                    <input
                      required
                      value={editingUser.login}
                      onChange={(e) => setEditingUser({ ...editingUser, login: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">Parol</label>
                    <input
                      required
                      value={editingUser.password || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">Email</label>
                    <input
                      type="email"
                      value={editingUser.email || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">Rol</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value as "admin" | "recruiter" })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <option value="recruiter">Rekruter</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 font-semibold text-slate-700">
                    {lang === "ru" ? "Доступные разделы:" : "Ochiladigan bo'limlar:"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => (
                      <label key={tr} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingUser.allowedTracks.includes(tr)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...editingUser.allowedTracks, tr]
                              : editingUser.allowedTracks.filter((x) => x !== tr);
                            setEditingUser({ ...editingUser, allowedTracks: next });
                          }}
                        />
                        <span>{getTrackTitle(tr, lang)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 font-semibold text-slate-700">
                    {lang === "ru" ? "Привязанные филиалы (пусто = все):" : "Biriktirilgan filiallar (bo'sh = barchasi):"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {allBranches.map((br) => (
                      <label key={br} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(editingUser.assignedBranches || []).includes(br)}
                          onChange={(e) => {
                            const curr = editingUser.assignedBranches || [];
                            const next = e.target.checked
                              ? [...curr, br]
                              : curr.filter((x) => x !== br);
                            setEditingUser({ ...editingUser, assignedBranches: next });
                          }}
                        />
                        <span className="truncate">{br}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {lang === "ru" ? "Отмена" : "Bekor qilish"}
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700"
                  >
                    {lang === "ru" ? "Сохранить" : "Saqlash"}
                  </button>
                </div>
              </form>
            </div>
          )}
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

            <div className="col-span-2">
              <label className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={Boolean(db.settings.instantTestMode)}
                  onChange={(e) =>
                    onUpdateDb({
                      ...db,
                      settings: {
                        ...db.settings,
                        instantTestMode: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                <span>
                  ⚡ Tez test rejimi (Kutishsiz) — Sinov kuni sanasi tanlanishi bilan ertalabki xabar va so&apos;rovnoma darhol yuboriladi
                </span>
              </label>
            </div>

            <div className="col-span-2 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="font-bold text-slate-800">
                  📊 Product Analytics (PostHog + Yandex Metrica)
                </p>
                <p className="text-[11px] text-slate-500">
                  Kalitlarni kiriting va «Saqlash» bosing — darhol ishga tushadi (kod o&apos;zgartirish shart emas)
                </p>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  PostHog Project API Key
                </label>
                <input
                  value={db.settings.posthogKey || ""}
                  onChange={(e) =>
                    onUpdateDb({
                      ...db,
                      settings: { ...db.settings, posthogKey: e.target.value },
                    })
                  }
                  placeholder="phc_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Yandex Metrica Counter ID
                </label>
                <input
                  value={db.settings.yandexMetricaId || ""}
                  onChange={(e) =>
                    onUpdateDb({
                      ...db,
                      settings: { ...db.settings, yandexMetricaId: e.target.value },
                    })
                  }
                  placeholder="98765432"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="col-span-2 pt-2">
              <p className="mb-2 font-bold text-slate-800">
                {lang === "ru"
                  ? "Материалы адаптации и опрос (нажмите на папку)"
                  : "Standartlar, Welcome Book va So'rovnoma (batafsil uchun papkani bosing)"}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(db.settings.onboardingFolders && db.settings.onboardingFolders.length > 0
                  ? db.settings.onboardingFolders
                  : DEFAULT_ONBOARDING_FOLDERS
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFolderId(f.id)}
                    className="group relative flex flex-col items-start rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3.5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-md"
                  >
                    <div className="mb-2 flex w-full items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white">
                        <Folder className="h-4 w-4" />
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            f.enabled !== false
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {f.enabled !== false ? "Faol" : "O'chiq"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {f.images?.length || 0} rasm
                        </span>
                      </span>
                    </div>
                    <p className="font-bold text-slate-900">{f.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                      {f.description}
                    </p>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setActiveFolderId("survey")}
                  className="group relative flex flex-col items-start rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-3.5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
                >
                  <div className="mb-2 flex w-full items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {(db.settings.testDaySurveyItems && db.settings.testDaySurveyItems.length > 0
                        ? db.settings.testDaySurveyItems
                        : DEFAULT_SURVEY_ITEMS
                      ).length}{" "}
                      savol
                    </span>
                  </div>
                  <p className="font-bold text-slate-900">Sinov kuni so'rovnomasi</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                    1–5 balli baholash va ochiq fikr savollari
                  </p>
                </button>
              </div>
            </div>
          </div>

          {activeFolderId && activeFolderId !== "survey" && (() => {
            const folders =
              db.settings.onboardingFolders && db.settings.onboardingFolders.length > 0
                ? db.settings.onboardingFolders
                : DEFAULT_ONBOARDING_FOLDERS;
            const current = folders.find((f) => f.id === activeFolderId)!;
            const updateFolder = (patch: Partial<OnboardingFolderItem>) => {
              const next = folders.map((f) =>
                f.id === activeFolderId ? { ...f, ...patch } : f
              );
              onUpdateDb({
                ...db,
                settings: { ...db.settings, onboardingFolders: next },
              });
            };
            return (
              <div
                onClick={(e) => {
                  if (e.target === e.currentTarget) setActiveFolderId(null);
                }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
              >
                <div className="w-full max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-xs shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">{current.title}</h3>
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={current.enabled !== false}
                      onChange={(e) => updateFolder({ enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span>Offer (Ish taklifi) bilan botda nomzodga yuborilsin</span>
                  </label>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">Sarlavha</label>
                    <input
                      value={current.title}
                      onChange={(e) => updateFolder({ title: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-600">
                      Matn / Qoidalar (botda yuboriladi)
                    </label>
                    <textarea
                      rows={5}
                      value={current.description}
                      onChange={(e) => updateFolder({ description: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="font-semibold text-slate-600">
                        Namuna rasmlar ({current.images?.length || 0})
                      </label>
                      <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100">
                        <ImagePlus className="h-3.5 w-3.5" />
                        Rasm yuklash
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            const dataUrls = await Promise.all(
                              files.map(
                                (file) =>
                                  new Promise<string>((resolve) => {
                                    const reader = new FileReader();
                                    reader.onload = () => resolve(String(reader.result || ""));
                                    reader.readAsDataURL(file);
                                  })
                              )
                            );
                            updateFolder({
                              images: [...(current.images || []), ...dataUrls.filter(Boolean)],
                            });
                          }}
                        />
                      </label>
                    </div>
                    {current.images && current.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {current.images.map((img, i) => (
                          <div key={i} className="group relative overflow-hidden rounded-xl border border-slate-200">
                            <img src={img} alt="standart" className="h-24 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() =>
                                updateFolder({
                                  images: current.images.filter((_, idx) => idx !== i),
                                })
                              }
                              className="absolute right-1 top-1 rounded-full bg-rose-600 p-1 text-white opacity-90 hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700"
                    >
                      Tayyor (Saqlash tugmasini bosing)
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeFolderId === "survey" && (() => {
            const items =
              db.settings.testDaySurveyItems && db.settings.testDaySurveyItems.length > 0
                ? db.settings.testDaySurveyItems
                : DEFAULT_SURVEY_ITEMS;
            const updateItems = (next: SurveyQuestionItem[]) => {
              onUpdateDb({
                ...db,
                settings: { ...db.settings, testDaySurveyItems: next },
              });
            };
            return (
              <div
                onClick={(e) => {
                  if (e.target === e.currentTarget) setActiveFolderId(null);
                }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
              >
                <div className="max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-xs shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900">
                      Sinov kuni so'rovnomasi savollari
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700">Savol #{idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={item.type}
                              onChange={(e) =>
                                updateItems(
                                  items.map((x, i) =>
                                    i === idx
                                      ? { ...x, type: e.target.value as "rating" | "text" }
                                      : x
                                  )
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold"
                            >
                              <option value="rating">⭐️ 1–5 ball (Reyting)</option>
                              <option value="text">✍️ Ochiq fikr (Matn)</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => updateItems(items.filter((_, i) => i !== idx))}
                              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <input
                          value={item.question}
                          onChange={(e) =>
                            updateItems(
                              items.map((x, i) =>
                                i === idx ? { ...x, question: e.target.value } : x
                              )
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateItems([
                          ...items,
                          {
                            id: `q-${Date.now()}`,
                            question: `${items.length + 1}. Yangi savol...`,
                            type: "rating",
                          },
                        ])
                      }
                      className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-3.5 w-3.5" /> Savol qo'shish
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700"
                    >
                      Tayyor
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
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
