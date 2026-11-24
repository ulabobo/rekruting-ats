export type Language = "uz" | "ru";

export type TrackType =
  | "dokon_xodimi"
  | "dokon_rahbari"
  | "ofis_xodimi"
  | "ommaviy_yollash";

export type UserRoleType = "admin" | "recruiter";

export type CandidateSource =
  | "Telegram bot"
  | "Tanish"
  | "OLX"
  | "Instagram"
  | "Telegram kanal"
  | "hh.uz"
  | "Sayt"
  | "LinkedIn"
  | "Tavsiya"
  | "Ichki nomzod"
  | "Kollej";

export type ApplicationStatus =
  | "active"
  | "offered"
  | "hired"
  | "rejected"
  | "reserved"
  | "blacklist";

export interface User {
  id: string;
  login: string;
  password?: string;
  email?: string;
  fullName: string;
  role: UserRoleType;
  allowedTracks: TrackType[];
  assignedBranches?: string[];
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
  region?: string;
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
  status: "open" | "accepted" | "closed" | "paused";
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
  avatarUrl?: string;
  tags: string[];
  questionnaireData?: Record<string, string>;
  createdAt: string;
}

export interface PositionProfile {
  id: string;
  track: TrackType;
  positionName: string;
  expectationUz?: string;
  expectationRu?: string;
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
  | "photo_3x4"
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
  sheetTab: string;
  region?: string;
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

export interface SurveyQuestionItem {
  id: string;
  question: string;
  type: "rating" | "text";
}

export interface OnboardingFolderItem {
  id: "welcome_book" | "dress_code" | "work_hours" | "store_conduct";
  title: string;
  description: string;
  images: string[]; // data URLs or image URLs
  enabled?: boolean;
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
  shifts?: string[];
  instantTestMode?: boolean;
  testDaySurveyQuestions?: string[];
  testDaySurveyItems?: SurveyQuestionItem[];
  welcomeBookText?: string;
  onboardingFolders?: OnboardingFolderItem[];
  googleSpreadsheetId?: string;
  googleSpreadsheetUrl?: string;
  googleLastSyncAt?: string;
  posthogKey?: string;
  posthogHost?: string;
  yandexMetricaId?: string;
}

export interface BotFunnelEntry {
  chatId: string;
  username?: string;
  firstName?: string;
  lastStep: string;
  furthestStep: string;
  furthestRank: number;
  status: "in_progress" | "completed" | "cancelled";
  remindedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingFlowSummary {
  id: string;
  applicationId: string;
  candidateId: string;
  step: string;
  testDate?: string;
  shift?: string;
  surveyAnswers: { question: string; answer: string }[];
  updatedAt: string;
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
  botFunnel?: BotFunnelEntry[];
  onboardingFlows?: OnboardingFlowSummary[];
  settings: SystemSettings;
}
