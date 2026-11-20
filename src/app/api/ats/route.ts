import { NextRequest, NextResponse } from "next/server";
import {
  acceptVacancy,
  addDocument,
  addEvaluation,
  createApplicationFromLead,
  createMassProject,
  createRecruiterUser,
  createVacancy,
  deletePositionProfile,
  deleteRecruiterUser,
  getFullDatabase,
  getSupabase,
  moveApplicationStage,
  rejectApplication,
  saveMessageTemplate,
  savePositionProfile,
  syncErpStaffingRows,
  transferToLms,
} from "@/lib/supabase-db";
import { isGoogleConfigured } from "@/lib/google-sheets";

export async function GET() {
  try {
    const db = await getFullDatabase();
    return NextResponse.json({
      db,
      googleConfigured: isGoogleConfigured(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database xatosi" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "move_stage") {
      const res = await moveApplicationStage({
        applicationId: body.applicationId,
        targetStage: body.targetStage,
        actorId: body.actorId || "u-admin",
        actorName: body.actorName || "Admin",
        lang: body.lang || "uz",
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "add_evaluation") {
      await addEvaluation({
        applicationId: body.applicationId,
        evaluatorId: body.evaluatorId || "u-admin",
        evaluatorName: body.evaluatorName || "Rekruter",
        evaluatorRole: body.evaluatorRole || "Rekruter",
        stage: body.stage,
        scores: body.scores || [],
        comment: body.comment || "",
        decision: body.decision || "pass",
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "upload_document") {
      await addDocument({
        applicationId: body.applicationId,
        docType: body.docType,
        fileName: body.fileName,
        fileUrl: body.fileUrl || "#uploaded",
        actorName: body.actorName || "Rekruter",
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "transfer_lms") {
      const res = await transferToLms({
        applicationId: body.applicationId,
        hireStartDate: body.hireStartDate,
        actorId: body.actorId || "u-admin",
        actorName: body.actorName || "Rekruter",
      });
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "reject_application") {
      await rejectApplication({
        applicationId: body.applicationId,
        reason: body.reason || "Rad etildi",
        actorId: body.actorId || "u-admin",
        actorName: body.actorName || "Rekruter",
        lang: body.lang || "uz",
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "accept_vacancy") {
      await acceptVacancy({
        vacancyId: body.vacancyId,
        recruiterId: body.recruiterId || "u-admin",
        recruiterName: body.recruiterName || "Rekruter",
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "create_vacancy") {
      await createVacancy({
        track: body.track,
        city: body.city || "Toshkent",
        branch: body.branch,
        position: body.position,
        shift: body.shift,
        salaryBand: body.salaryBand,
        headcount: Number(body.headcount) || 1,
        hiringManagerName: body.hiringManagerName || "Rahbar",
        responsibleRecruiterId: body.responsibleRecruiterId || "u-admin",
        erpRequestId: body.erpRequestId,
        actorName: body.actorName || "Admin",
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "create_mass_project") {
      await createMassProject({
        storeName: body.storeName,
        address: body.address,
        openingDate: body.openingDate,
        createdBy: body.createdBy || "Admin",
        quotas: body.quotas || [],
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "create_candidate_lead") {
      const res = await createApplicationFromLead({
        phone: body.phone,
        fullName: body.fullName,
        vacancyId: body.vacancyId,
        source: body.source || "Sayt",
        birthDate: body.birthDate,
        address: body.address,
        experienceYears: body.experienceYears,
        education: body.education,
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db, isDuplicate: res.isDuplicate });
    }

    if (action === "save_template") {
      await saveMessageTemplate({
        track: body.track,
        stage: body.stage,
        enabled: Boolean(body.enabled),
        templateUz: body.templateUz,
        templateRu: body.templateRu,
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "save_position_profile") {
      await savePositionProfile({
        track: body.track,
        positionName: body.positionName,
        expectationUz: body.expectationUz,
        expectationRu: body.expectationRu,
        criteria: body.criteria || [],
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "delete_position_profile") {
      await deletePositionProfile(body.profileId);
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "create_user") {
      await createRecruiterUser({
        login: body.login,
        password: body.password,
        fullName: body.fullName,
        position: body.position || "Rekruter",
        role: body.role || "recruiter",
        allowedTracks: body.allowedTracks || ["dokon_xodimi"],
      });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "delete_user") {
      await deleteRecruiterUser(body.userId);
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "sync_erp_staffing") {
      const res = await syncErpStaffingRows(body.rows || []);
      const db = await getFullDatabase();
      return NextResponse.json({ db, openedVacancies: res.openedVacancies });
    }

    if (action === "update_settings") {
      const sb = getSupabase();
      await sb
        .from("ats_settings")
        .upsert({ id: "default", data: body.settings }, { onConflict: "id" });
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    if (action === "mark_notifications_read") {
      const sb = getSupabase();
      await sb.from("ats_notifications").update({ read: true }).eq("read", false);
      const db = await getFullDatabase();
      return NextResponse.json({ db });
    }

    return NextResponse.json({ error: "Noma'lum amal" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server xatosi" },
      { status: 500 }
    );
  }
}
