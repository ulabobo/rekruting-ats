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
import { AtsDatabase, ErpStaffingRow, Language, TrackType } from "@/types/ats";
import { TRACK_CONFIGS, getTrackTitle } from "@/lib/stages";

const SHEET_TABS = [
  "Aura-1",
  "Aura-2",
  "Aura-3",
  "Aura-4",
  "Bosh ofis",
  "Toshkent ombor",
] as const;

export default function IntegrationsPanel({
  db,
  lang,
  onUpdateDb,
}: {
  db: AtsDatabase;
  lang: Language;
  onUpdateDb: (db: AtsDatabase) => void;
}) {
  const [activeTab, setActiveTab] = useState<string>("Aura-1");
  const [rows, setRows] = useState<ErpStaffingRow[]>(db.erpStaffing);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const tabRows = rows.filter((r) => (r.sheetTab || "Aura-1") === activeTab);

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

  const appsScriptCode = `function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var name = sheet.getName();
  var allowed = ["Aura-1", "Aura-2", "Aura-3", "Aura-4", "Bosh ofis", "Toshkent ombor"];
  if (allowed.indexOf(name) === -1) return;
  var row = e.range.getRow();
  if (row < 2) return;
  var vals = sheet.getRange(row, 1, 1, 7).getValues()[0];
  UrlFetchApp.fetch("https://rekruting-ats.onrender.com/api/integrations/erp", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      eventType: "ERP_STAFFING_SYNC",
      rows: [{
        sheetTab: name,
        region: vals[0] || "Toshkent shahri",
        city: vals[1] || "Toshkent",
        branch: name,
        position: vals[2],
        track: vals[3] || "dokon_xodimi",
        planCount: Number(vals[4]) || 0,
        factCount: Number(vals[5]) || 0,
        shift: vals[6] || "2/2 smena",
        salaryBand: "Shtat bo'yicha"
      }]
    })
  });
}`;

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
            ? "Листы Aura-1..4, Головной офис и Склад Ташкент. Если Факт < План — автоматически открывается вакансия."
            : "Aura-1, Aura-2, Aura-3, Aura-4, Bosh ofis va Toshkent ombor listlari. Fakt < Plan bo'lganda avtomatik vakansiya ochiladi."}
        </p>
      </div>

      {/* Sheet Tabs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {SHEET_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === tab
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {db.settings.googleSpreadsheetUrl && (
              <a
                href={db.settings.googleSpreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
              >
                Rekrut ATS <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  {
                    id: `erp-${Date.now()}`,
                    sheetTab: activeTab,
                    region: activeTab === "Bosh ofis" ? "Bosh ofis" : activeTab === "Toshkent ombor" ? "Toshkent ombor" : "Toshkent shahri",
                    city: "Toshkent",
                    branch: activeTab,
                    position: "",
                    track: activeTab === "Bosh ofis" ? "ofis_xodimi" : "dokon_xodimi",
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
              {lang === "ru" ? "Добавить" : "Qator qo'shish"}
            </button>

            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncStaffing}
              className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {lang === "ru" ? "Синхронизировать" : "Shtatni tekshirish"}
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
                <th className="pb-2 font-semibold">{lang === "ru" ? "Регион" : "Hudud / Viloyat"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Город" : "Shahar"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Должность" : "Lavozim"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Направление" : "Yo'nalish"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "План" : "Plan"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Факт" : "Fakt"}</th>
                <th className="pb-2 font-semibold">{lang === "ru" ? "Вакансия" : "Bo'sh o'rin"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tabRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    {activeTab}: {lang === "ru" ? "Нет записей" : "Shtat qatorlari yo'q"}
                  </td>
                </tr>
              ) : (
                tabRows.map((r) => {
                  const idx = rows.findIndex((x) => x.id === r.id);
                  const deficit = Math.max(0, r.planCount - r.factCount);
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-2">
                        <input
                          value={r.region || ""}
                          onChange={(e) => {
                            const next = [...rows];
                            next[idx].region = e.target.value;
                            setRows(next);
                          }}
                          className="w-32 rounded-lg border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={r.city}
                          onChange={(e) => {
                            const next = [...rows];
                            next[idx].city = e.target.value;
                            setRows(next);
                          }}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          value={r.position}
                          placeholder="Lavozim"
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
                          <span className="font-semibold text-emerald-600">OK</span>
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

      {/* Google Apps Script for real-time Google Sheets onEdit */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-2 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Google Sheets Auto-Trigger (Apps Script)
            </h3>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            Google Sheets → <b>Extensions → Apps Script</b> ga quyidagi kodni joylashtirsangiz,
            Aura-1..4, Bosh ofis yoki Toshkent ombor varaqlarida Plan/Fakt o&apos;zgarganda darhol
            ATS ga vakansiya so&apos;rovi keladi:
          </p>
          <pre className="max-h-44 overflow-auto rounded-xl bg-zinc-900 p-3 text-[10px] text-zinc-100">
            {appsScriptCode}
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Database className="h-4 w-4 text-teal-700" />
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
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
            <Bot className="h-4 w-4 shrink-0 text-sky-600" />
            Webhook faol: https://rekruting-ats.onrender.com/api/telegram/webhook
          </div>
        </div>
      </div>
    </div>
  );
}
