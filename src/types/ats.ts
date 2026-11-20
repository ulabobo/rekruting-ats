export type Language = "uz" | "ru";

export type TrackType =
  | "dokon_xodimi"
  | "dokon_rahbari"
  | "ofis_xodimi"
  | "ommaviy_yollash";

export type UserRoleType = "admin" | "recruiter";

export type CandidateSource =
  | "Telegram bot"
  | "Sayt"
  | "OLX"
  | "hh.uz"
  | "LinkedIn"
  | "Tavsiya"
  | "Ichki nomzod"
  | "Kollej";

export type ApplicationStatus =
  | "active"
  | "offered"
  | "hired"
  | "rejected"
  | "reserved";

export interface User {
  id: string;
  login: string;
  fullName: string;
  role: UserRoleType;
  allowedTracks: TrackType[];
  position: string;
  createdAt?: string;
}

export interface MassHiringQuota {
  position: string;
  requiredCount: number;
  hiredCount: number;
  shift?: string;
}

export interface MassHiringProject {
  id: string;
  storeName: string;
  address: string;
  openingDate: string;
  createdBy: string;
  status: "planning" | "approved" | "recruiting" | "completed";
  quotas: MassHiringQuota[];
  createdAt: string;
}

export interface Vacancy {
  id: string;
  track: TrackType;
  city: string;
  branch: string;
  position: string;
  shift?: string;
  salaryBand: string;
  headcount: number;
  filledCount: number;
  approvedAt: string;
  slaDays: number;
  erpRequestId?: string;
  massProjectId?: string;
  responsibleRecruiterId: string;
  hiringManagerName: string;
  status: "open" | "closed" | "paused";
}

export interface Candidate {
  id: string;
  phone: string;
  fullName: string;
  birthDate?: string;
  gender?: string;
  city?: string;
  address?: string;
  region?: string;
  experienceYears?: string;
  education?: string;
  lastWorkplace?: string;
  expectedSalary?: string;
  source: CandidateSource;
  isInternal: boolean;
  internalCategory?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  tags: string[];
  createdAt: string;
}

export interface PositionProfile {
  id: string;
  track: TrackType;
  positionName: string;
  criteria: { uz: string; ru: string }[];
  updatedAt: string;
}

export interface Application {
  id: string;
  candidateId: string;
  vacancyId: string;
  track: TrackType;
  currentStage: string;
  stageEnteredAt: string;
  appliedAt: string;
  status: ApplicationStatus;
  matchScore: number;
  rejectionReason?: string;
  offerSentAt?: string;
  hireStartDate?: string;
  lmsTransferredAt?: string;
  assignedRecruiterId: string;
  isDuplicateWarning?: boolean;
}

export interface EvaluationCriteriaScore {
  criterion: string;
  score: number;
}

export interface Evaluation {
  id: string;
  applicationId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  stage: string;
  scores: EvaluationCriteriaScore[];
  averageScore: number;
  comment: string;
  decision: "pass" | "fail" | "offer" | "reject";
  createdAt: string;
}

export type DocumentType =
  | "anketa"
  | "rozilik"
  | "amaliy_topshiriq"
  | "offer"
  | "pasport_id"
  | "welcome_book";

export interface DocumentRecord {
  id: string;
  applicationId: string;
  docType: DocumentType;
  fileName: string;
  fileUrl: string;
  verified: boolean;
  uploadedAt: string;
}

export interface AuditLog {
  id: string;
  entityType: "application" | "vacancy" | "candidate" | "mass_project" | "settings" | "user";
  entityId: string;
  actorId: string;
  actorName: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  track: TrackType;
  stage: string; // bosqich id yoki "rejected"
  enabled: boolean;
  templateUz: string;
  templateRu: string;
  updatedAt: string;
}

export interface ErpStaffingRow {
  id: string;
  city: string;
  branch: string;
  position: string;
  track: TrackType;
  planCount: number;
  factCount: number;
  shift: string;
  salaryBand: string;
  updatedAt: string;
}

export interface IntegrationEvent {
  id: string;
  direction: "inbound" | "outbound";
  system: "OneERP" | "TelegramBot" | "LMS" | "GoogleSheets" | "OLX" | "hh.uz";
  eventType: string;
  payloadSummary: string;
  status: "success" | "pending" | "failed";
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "action";
  read: boolean;
  relatedApplicationId?: string;
  createdAt: string;
}

export interface SystemSettings {
  internalCandidateMinCategory: string;
  internalCandidateMinTenureMonths: number;
  internalSelectionDays: number;
  storeEmployeeSlaDays: number;
  storeManagerSlaDays: number;
  officeEmployeeSlaDays: number;
  offerTimerStoreDays: number;
  offerTimerOfficeDays: number;
  googleSpreadsheetId?: string;
  googleSpreadsheetUrl?: string;
  googleLastSyncAt?: string;
}

export interface AtsDatabase {
  users: User[];
  massProjects: MassHiringProject[];
  vacancies: Vacancy[];
  candidates: Candidate[];
  applications: Application[];
  evaluations: Evaluation[];
  documents: DocumentRecord[];
  auditLogs: AuditLog[];
  messageTemplates: MessageTemplate[];
  positionProfiles: PositionProfile[];
  erpStaffing: ErpStaffingRow[];
  integrationEvents: IntegrationEvent[];
  notifications: NotificationItem[];
  settings: SystemSettings;
}
