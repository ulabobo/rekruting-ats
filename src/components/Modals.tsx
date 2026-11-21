"use client";

import React, { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { AtsDatabase, CandidateSource, Language, TrackType, User } from "@/types/ats";
import { TRACK_CONFIGS, getTrackTitle } from "@/lib/stages";

function ModalBase({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CreateVacancyModal({
  defaultTrack,
  currentUser,
  lang,
  onClose,
  onSuccess,
}: {
  defaultTrack: TrackType;
  currentUser: User;
  lang: Language;
  onClose: () => void;
  onSuccess: (db: AtsDatabase) => void;
}) {
  const [track, setTrack] = useState<TrackType>(defaultTrack);
  const [city, setCity] = useState("Toshkent");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [shift, setShift] = useState("2/2 smena");
  const [salaryBand, setSalaryBand] = useState("");
  const [headcount, setHeadcount] = useState(1);
  const [hiringManagerName, setHiringManagerName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_vacancy",
          track,
          city,
          branch,
          position,
          shift,
          salaryBand,
          headcount,
          hiringManagerName,
          responsibleRecruiterId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const data = await res.json();
      if (data.db) {
        onSuccess(data.db);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase
      title={lang === "ru" ? "Новая вакансия" : "Yangi vakansiya ochish"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "Направление" : "Yo'nalish"}
            </label>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as TrackType)}
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
              {lang === "ru" ? "Город" : "Shahar"}
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              {["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "Должность" : "Lavozim"}
            </label>
            <input
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "Филиал" : "Filial"}
            </label>
            <input
              required
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "График" : "Smena / Grafik"}
            </label>
            <input
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "Количество" : "Shtat soni"}
            </label>
            <input
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "Зарплата" : "Maosh"}
            </label>
            <input
              value={salaryBand}
              onChange={(e) => setSalaryBand(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              {lang === "ru" ? "Руководитель" : "Mas'ul rahbar"}
            </label>
            <input
              value={hiringManagerName}
              onChange={(e) => setHiringManagerName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
          >
            {lang === "ru" ? "Отмена" : "Bekor qilish"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            {loading ? "..." : lang === "ru" ? "Создать" : "Yaratish"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

export function CreateMassProjectModal({
  currentUser,
  lang,
  onClose,
  onSuccess,
}: {
  currentUser: User;
  lang: Language;
  onClose: () => void;
  onSuccess: (db: AtsDatabase) => void;
}) {
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [openingDate, setOpeningDate] = useState(
    new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10)
  );
  const [quotas, setQuotas] = useState([
    { position: "Sotuvchi-maslahatchi", requiredCount: 15, shift: "2/2 smena" },
    { position: "Kassir", requiredCount: 8, shift: "2/2 smena" },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_mass_project",
          storeName,
          address,
          openingDate,
          createdBy: currentUser.fullName,
          quotas,
        }),
      });
      const data = await res.json();
      if (data.db) {
        onSuccess(data.db);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase
      title={lang === "ru" ? "Открытие нового магазина" : "Yangi do'kon ochilishi"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <input
          required
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder={lang === "ru" ? "Название магазина" : "Do'kon nomi"}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={lang === "ru" ? "Адрес" : "Manzil"}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
          <input
            type="date"
            required
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-slate-700">
              {lang === "ru" ? "Квоты" : "Shtat kvotalari"}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuotas((q) => [...q, { position: "", requiredCount: 5, shift: "2/2" }])
              }
              className="inline-flex items-center gap-1 font-semibold text-blue-600"
            >
              <Plus className="h-3.5 w-3.5" /> {lang === "ru" ? "Добавить" : "Qo'shish"}
            </button>
          </div>
          <div className="space-y-2">
            {quotas.map((q, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  required
                  value={q.position}
                  onChange={(e) => {
                    const next = [...quotas];
                    next[idx].position = e.target.value;
                    setQuotas(next);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5"
                />
                <input
                  type="number"
                  min={1}
                  value={q.requiredCount}
                  onChange={(e) => {
                    const next = [...quotas];
                    next[idx].requiredCount = Number(e.target.value);
                    setQuotas(next);
                  }}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={() => setQuotas((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
          >
            {lang === "ru" ? "Отмена" : "Bekor qilish"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white"
          >
            {loading ? "..." : lang === "ru" ? "Запустить" : "Ishga tushirish"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

export function AddCandidateModal({
  db,
  defaultTrack,
  lang,
  onClose,
  onSuccess,
}: {
  db: AtsDatabase;
  defaultTrack: TrackType;
  lang: Language;
  onClose: () => void;
  onSuccess: (db: AtsDatabase, isDuplicate: boolean) => void;
}) {
  const openVacancies = db.vacancies.filter(
    (v) => v.status === "open" || v.status === "accepted"
  );
  const defaultVac = openVacancies.find((v) => v.track === defaultTrack) || openVacancies[0];

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [vacancyId, setVacancyId] = useState(defaultVac?.id || "");
  const [source, setSource] = useState<CandidateSource>("Telegram bot");
  const [experienceYears, setExperienceYears] = useState("1–2 yil");
  const [address, setAddress] = useState("Toshkent sh.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !vacancyId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_candidate_lead",
          fullName,
          phone,
          vacancyId,
          source,
          experienceYears,
          address,
        }),
      });
      const data = await res.json();
      if (data.db) {
        onSuccess(data.db, Boolean(data.isDuplicate));
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase
      title={lang === "ru" ? "Добавить кандидата" : "Yangi nomzod qo'shish"}
      onClose={onClose}
    >
      {openVacancies.length === 0 ? (
        <p className="text-xs text-rose-600">
          {lang === "ru"
            ? "Сначала откройте хотя бы одну вакансию!"
            : "Avval kamida bitta ochiq vakansiya yarating!"}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={lang === "ru" ? "ФИО кандидата" : "Nomzod F.I.O"}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998901234567"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as CandidateSource)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="Telegram bot">Telegram bot</option>
              <option value="Sayt">Sayt</option>
              <option value="OLX">OLX</option>
              <option value="hh.uz">hh.uz</option>
              <option value="Tavsiya">Tavsiya</option>
              <option value="Ichki nomzod">Ichki nomzod</option>
            </select>
          </div>
          <select
            value={vacancyId}
            onChange={(e) => setVacancyId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            {openVacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.position} — {v.branch}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              placeholder={lang === "ru" ? "Опыт" : "Tajriba"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={lang === "ru" ? "Адрес" : "Manzil"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
            >
              {lang === "ru" ? "Отмена" : "Bekor qilish"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white"
            >
              {loading ? "..." : lang === "ru" ? "Добавить" : "Qo'shish"}
            </button>
          </div>
        </form>
      )}
    </ModalBase>
  );
}
