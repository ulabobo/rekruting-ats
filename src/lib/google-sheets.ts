import { google } from "googleapis";
import { AtsDatabase } from "@/types/ats";

const SPREADSHEET_TITLE = "Rekrut ATS";

const SHEET_TABS = [
  "Vacancies",
  "MassProjects",
  "Candidates",
  "Applications",
  "Evaluations",
  "Documents",
  "AuditLogs",
  "IntegrationEvents",
  "Settings",
] as const;

export interface GoogleSyncStatus {
  configured: boolean;
  connected: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncAt?: string;
  message: string;
}

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();

  if (!email || !rawKey) {
    return null;
  }

  const privateKey = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_PRIVATE_KEY?.trim()
  );
}

export async function ensureRekrutAtsSpreadsheet(
  existingId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const auth = getAuthClient();
  if (!auth) {
    throw new Error(
      "Google Service Account sozlanmagan (.env.local da GOOGLE_SERVICE_ACCOUNT_EMAIL va GOOGLE_PRIVATE_KEY kerak)."
    );
  }

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  let spreadsheetId = existingId || process.env.GOOGLE_SPREADSHEET_ID?.trim() || "";

  if (!spreadsheetId) {
    const query = `name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const listRes = await drive.files.list({
      q: query,
      fields: "files(id, name, webViewLink)",
      spaces: "drive",
    });

    const found = listRes.data.files?.[0];
    if (found?.id) {
      spreadsheetId = found.id;
    }
  }

  if (!spreadsheetId) {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: SPREADSHEET_TITLE,
          locale: "uz_UZ",
        },
        sheets: SHEET_TABS.map((title) => ({
          properties: { title },
        })),
      },
    });

    spreadsheetId = created.data.spreadsheetId || "";
    if (!spreadsheetId) {
      throw new Error("Google Sheets faylini yaratib bo'lmadi.");
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
    if (folderId) {
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: folderId,
        fields: "id, parents",
      });
    }
  } else {
    // Ensure all required tabs exist
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = new Set(
      meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) as string[]
    );
    const missing = SHEET_TABS.filter((t) => !existingTitles.has(t));
    if (missing.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
    }
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function syncDatabaseToGoogleSheets(
  db: AtsDatabase
): Promise<GoogleSyncStatus> {
  if (!isGoogleConfigured()) {
    return {
      configured: false,
      connected: false,
      spreadsheetId: db.settings.googleSpreadsheetId,
      spreadsheetUrl: db.settings.googleSpreadsheetUrl,
      lastSyncAt: db.settings.googleLastSyncAt,
      message:
        "Google Drive API kalitlari kiritilmagan — ma'lumotlar mahalliy bazada saqlanmoqda.",
    };
  }

  try {
    const auth = getAuthClient()!;
    const sheets = google.sheets({ version: "v4", auth });
    const { spreadsheetId, spreadsheetUrl } = await ensureRekrutAtsSpreadsheet(
      db.settings.googleSpreadsheetId
    );

    const tabPayloads: Record<(typeof SHEET_TABS)[number], (string | number | boolean)[][]> = {
      Vacancies: [
        [
          "id",
          "track",
          "branch",
          "position",
          "shift",
          "salaryBand",
          "headcount",
          "filledCount",
          "approvedAt",
          "slaDays",
          "erpRequestId",
          "massProjectId",
          "responsibleRecruiterId",
          "hiringManagerName",
          "status",
        ],
        ...db.vacancies.map((v) => [
          v.id,
          v.track,
          v.branch,
          v.position,
          v.shift || "",
          v.salaryBand,
          v.headcount,
          v.filledCount,
          v.approvedAt,
          v.slaDays,
          v.erpRequestId || "",
          v.massProjectId || "",
          v.responsibleRecruiterId,
          v.hiringManagerName,
          v.status,
        ]),
      ],
      MassProjects: [
        ["id", "storeName", "address", "openingDate", "createdBy", "status", "quotasJson", "createdAt"],
        ...db.massProjects.map((p) => [
          p.id,
          p.storeName,
          p.address,
          p.openingDate,
          p.createdBy,
          p.status,
          JSON.stringify(p.quotas),
          p.createdAt,
        ]),
      ],
      Candidates: [
        [
          "id",
          "phone",
          "fullName",
          "birthDate",
          "gender",
          "address",
          "region",
          "experienceYears",
          "education",
          "lastWorkplace",
          "expectedSalary",
          "source",
          "isInternal",
          "internalCategory",
          "telegramChatId",
          "tags",
          "createdAt",
        ],
        ...db.candidates.map((c) => [
          c.id,
          c.phone,
          c.fullName,
          c.birthDate || "",
          c.gender || "",
          c.address || "",
          c.region || "",
          c.experienceYears || "",
          c.education || "",
          c.lastWorkplace || "",
          c.expectedSalary || "",
          c.source,
          c.isInternal,
          c.internalCategory || "",
          c.telegramChatId || "",
          c.tags.join(", "),
          c.createdAt,
        ]),
      ],
      Applications: [
        [
          "id",
          "candidateId",
          "vacancyId",
          "track",
          "currentStage",
          "stageEnteredAt",
          "appliedAt",
          "status",
          "matchScore",
          "rejectionReason",
          "offerSentAt",
          "hireStartDate",
          "lmsTransferredAt",
          "assignedRecruiterId",
        ],
        ...db.applications.map((a) => [
          a.id,
          a.candidateId,
          a.vacancyId,
          a.track,
          a.currentStage,
          a.stageEnteredAt,
          a.appliedAt,
          a.status,
          a.matchScore,
          a.rejectionReason || "",
          a.offerSentAt || "",
          a.hireStartDate || "",
          a.lmsTransferredAt || "",
          a.assignedRecruiterId,
        ]),
      ],
      Evaluations: [
        [
          "id",
          "applicationId",
          "evaluatorName",
          "evaluatorRole",
          "stage",
          "averageScore",
          "decision",
          "comment",
          "scoresJson",
          "createdAt",
        ],
        ...db.evaluations.map((e) => [
          e.id,
          e.applicationId,
          e.evaluatorName,
          e.evaluatorRole,
          e.stage,
          e.averageScore,
          e.decision,
          e.comment,
          JSON.stringify(e.scores),
          e.createdAt,
        ]),
      ],
      Documents: [
        ["id", "applicationId", "docType", "fileName", "fileUrl", "verified", "uploadedAt"],
        ...db.documents.map((d) => [
          d.id,
          d.applicationId,
          d.docType,
          d.fileName,
          d.fileUrl,
          d.verified,
          d.uploadedAt,
        ]),
      ],
      AuditLogs: [
        ["id", "entityType", "entityId", "actorName", "action", "oldValue", "newValue", "createdAt"],
        ...db.auditLogs.map((l) => [
          l.id,
          l.entityType,
          l.entityId,
          l.actorName,
          l.action,
          l.oldValue || "",
          l.newValue || "",
          l.createdAt,
        ]),
      ],
      IntegrationEvents: [
        ["id", "direction", "system", "eventType", "payloadSummary", "status", "createdAt"],
        ...db.integrationEvents.map((ev) => [
          ev.id,
          ev.direction,
          ev.system,
          ev.eventType,
          ev.payloadSummary,
          ev.status,
          ev.createdAt,
        ]),
      ],
      Settings: [
        ["key", "value"],
        ...Object.entries(db.settings).map(([k, v]) => [k, String(v ?? "")]),
      ],
    };

    for (const tab of SHEET_TABS) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${tab}!A:Z`,
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: tabPayloads[tab],
        },
      });
    }

    const now = new Date().toISOString();
    return {
      configured: true,
      connected: true,
      spreadsheetId,
      spreadsheetUrl,
      lastSyncAt: now,
      message: "Rekrut ATS fayliga muvaffaqiyatli sinxronizatsiya qilindi.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Noma'lum xato";
    return {
      configured: true,
      connected: false,
      spreadsheetId: db.settings.googleSpreadsheetId,
      spreadsheetUrl: db.settings.googleSpreadsheetUrl,
      message: `Google Sheets sinxronizatsiya xatosi: ${msg}`,
    };
  }
}

export async function appendHujjatlarRowToSheets(params: {
  existingSpreadsheetId?: string;
  webhookUrl?: string;
  row: {
    date: string;
    fullName: string;
    birthDate?: string;
    gender?: string;
    address?: string;
    phone: string;
    education?: string;
    experience?: string;
    branch: string;
    position: string;
    shift: string;
    salary: string;
    testDate: string;
    passportFrontUrl: string;
    passportBackUrl: string;
    photo3x4Url: string;
    surveySummary: string;
  };
}): Promise<{ ok: boolean; error?: string }> {
  const hook = (params.webhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append_hujjatlar", row: params.row }),
        redirect: "follow",
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `Webhook HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Webhook xatosi",
      };
    }
  }

  const auth = getAuthClient();
  if (!auth) return { ok: false, error: "Google Sheets ulanmagan" };

  try {
    const { spreadsheetId } = await ensureRekrutAtsSpreadsheet(params.existingSpreadsheetId);
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = meta.data.sheets?.some(
      (s) => s.properties?.title === "Hujjatlar"
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "Hujjatlar" } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Hujjatlar!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              "Sana",
              "F.I.O",
              "Tug'ilgan sana",
              "Jinsi",
              "Manzil",
              "Telefon (Hujjat)",
              "Ma'lumoti",
              "Tajriba",
              "Filial",
              "Lavozim",
              "Smena",
              "Oylik maosh",
              "Sinov sanasi",
              "Pasport / ID (Oldi)",
              "Pasport / ID (Orqasi)",
              "3x4 Rasm",
              "Sinov so'rovnomasi",
            ],
          ],
        },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Hujjatlar!A:Q",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            params.row.date,
            params.row.fullName,
            params.row.birthDate || "—",
            params.row.gender || "—",
            params.row.address || "—",
            params.row.phone,
            params.row.education || "—",
            params.row.experience || "—",
            params.row.branch,
            params.row.position,
            params.row.shift,
            params.row.salary,
            params.row.testDate,
            params.row.passportFrontUrl,
            params.row.passportBackUrl,
            params.row.photo3x4Url,
            params.row.surveySummary,
          ],
        ],
      },
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sheets append xatosi",
    };
  }
}

export async function incrementStaffingFactInSheets(params: {
  branch: string;
  position: string;
  webhookUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const hook = (params.webhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "increment_band",
          branch: params.branch,
          position: params.position,
        }),
        redirect: "follow",
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `Webhook HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Webhook xatosi",
      };
    }
  }

  const auth = getAuthClient();
  if (!auth) return { ok: false, error: "Google Sheets ulanmagan" };

  const spreadsheetId =
    process.env.GOOGLE_SPREADSHEET_ID?.trim() ||
    "1YA4_0soHhRSBpeyVkNq9LatOWsi_Pj6XR5yKnwm9QA4";

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${params.branch}!A1:M100`,
    });
    const rows = res.data.values || [];
    if (rows.length === 0) return { ok: false, error: "Shtatka varag'i bo'sh" };

    let idxPos = 2;
    let idxFact = 5;
    let headerRow = 0;

    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const upper = rows[r].map((c) => String(c || "").toUpperCase());
      const pIdx = upper.findIndex((c) => c.includes("LAVOZIM"));
      const fIdx = upper.findIndex(
        (c) => c.includes("BAND") || c.includes("FAKT") || c.includes("FACT")
      );
      if (pIdx !== -1 && fIdx !== -1) {
        idxPos = pIdx;
        idxFact = fIdx;
        headerRow = r;
        break;
      }
    }

    const targetPos = params.position.trim().toLowerCase();
    for (let r = headerRow + 1; r < rows.length; r++) {
      const cellPos = String(rows[r][idxPos] || "").trim().toLowerCase();
      if (cellPos === targetPos) {
        const currFact = Number(String(rows[r][idxFact] || "0").replace(/\D/g, "")) || 0;
        const colLetter = String.fromCharCode(65 + idxFact);
        const cellRef = `${params.branch}!${colLetter}${r + 1}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: cellRef,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[currFact + 1]] },
        });
        return { ok: true };
      }
    }
    return { ok: false, error: "Lavozim shtatkada topilmadi" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Shtatka update xatosi",
    };
  }
}
