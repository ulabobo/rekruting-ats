"use client";

import React, { useState } from "react";
import {
  Bot,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  RefreshCw,
} from "lucide-react";
import { AtsDatabase, Language, TrackType } from "@/types/ats";
import { TRACK_CONFIGS, getTrackTitle } from "@/lib/stages";

export default function IntegrationsPanel({
  db,
  lang,
  onUpdateDb,
}: {
  db: AtsDatabase;
  lang: Language;
  onUpdateDb: (db: AtsDatabase) => void;
}) {
  const [rows, setRows] = useState(db.erpStaffing);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSyncStaffing = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_erp_staffing",
          rows,
        }),
      });
      const data = await res.json();
      if (data.db) {
        onUpdateDb(data.db);
        setMsg(
          lang === "ru"
            ? `Штат проверен! Открыто новых вакансий: ${data.openedVacancies}`
            : `Shtat tekshirildi! Ochilgan yangi vakansiyalar: ${data.openedVacancies} ta`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {lang === "ru"
            ? "Google Sheets (ERP Штат) и Telegram Бот"
            : "Google Sheets (ERP Shtat) va Telegram Bot"}
        </h2>
        <p className="text-xs text-slate-500">
          {lang === "ru"
            ? "Если в штате Факт < План, система автоматически откроет вакансию и отправит уведомление в ATS"
            : "Shtat jadvalida Fakt soni Plandan kamayganda, ATS avtomatik vakansiya ochadi va bildirishnoma yuboradi"}
        </p>
      </div>

      {/* ERP Staffing Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "ru" ? "Штатное расписание (ERP)" : "Shtat jadvali (Sheets ERP)"}
            </h3>
            {db.settings.googleSpreadsheetUrl && (
              <a
                href={db.settings.googleSpreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Rekrut ATS <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  {
                    id: `erp-${Date.now()}`,
                    city: "Toshkent",
                    branch: "",
                    position: "",
                    track: "dokon_xodimi",
                    planCount: 1,
                    factCount: 1,
                    shift: "2/2 smena",
                    salaryBand: "",
                    updatedAt: new Date().toISOString(),
                  },
                ])
              }
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === "ru" ? "Добавить строку" : "Qator qo'shish"}
            </button>

            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncStaffing}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {lang === "ru" ? "Проверить штат (Sync)" : "Shtatni tekshirish (Sync)"}
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            {msg}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 font-semibold">{lang === "ru" ? "Город" : "Shahar"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Филиал" : "Filial"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Должность" : "Lavozim"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Направление" : "Yo'nalish"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "План" : "Plan"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Факт" : "Fakt"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Вакансия" : "Bo'sh o'rin"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    {lang === "ru"
                      ? "Штат пуст. Нажмите «Добавить строку»."
                      : "Shtat jadvali bo'sh. «Qator qo'shish» tugmasini bosing."}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                const deficit = Math.max(0, r.planCount - r.factCount);
                return (
                  <tr key={r.id}>
                    <td className="py-2 pr-2">
                      <input
                        value={r.city}
                        placeholder="Shahar"
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx].city = e.target.value;
                          setRows(next);
                        }}
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={r.branch}
                        placeholder="Filial nomi"
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx].branch = e.target.value;
                          setRows(next);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={r.position}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx].position = e.target.value;
                          setRows(next);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={r.track}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx].track = e.target.value as TrackType;
                          setRows(next);
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1"
                      >
                        {(Object.keys(TRACK_CONFIGS) as TrackType[]).map((tr) => (
                          <option key={tr} value={tr}>
                            {getTrackTitle(tr, lang)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        value={r.planCount}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx].planCount = Number(e.target.value);
                          setRows(next);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        value={r.factCount}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx].factCount = Number(e.target.value);
                          setRows(next);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </td>
                    <td className="py-2">
                      {deficit > 0 ? (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-700">
                          +{deficit} {lang === "ru" ? "откроется" : "ochiladi"}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Telegram Webhook & Integration Events */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-5 w-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">Telegram Bot</h3>
          </div>
          <p className="text-xs text-slate-600">
            {lang === "ru"
              ? "Бот работает автоматически по шаблонам из раздела Админ и Настройки."
              : "Bot Admin va Sozlamalardagi shablonlar asosida avtomatik xabar yuboradi."}
          </p>
          <p className="mt-3 rounded-lg bg-slate-100 p-2 font-mono text-[11px] text-slate-700">
            Webhook: /api/telegram/webhook
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Database className="h-4 w-4 text-blue-600" />
            {lang === "ru" ? "Журнал интеграций" : "Integratsiyalar jurnali"}
          </h3>
          <div className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
            {db.integrationEvents.length === 0 ? (
              <p className="text-slate-400">—</p>
            ) : (
              db.integrationEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="font-medium text-slate-700">
                    <b>[{ev.system}]</b> {ev.payloadSummary}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">
                    {ev.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
