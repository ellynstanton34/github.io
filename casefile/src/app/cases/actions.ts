"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCase, requireUser } from "@/lib/auth";
import { AiError, draftScript } from "@/lib/ai";
import { loadCaseContext } from "@/lib/case-data";
import { checkEpisode, rescoreEpisode } from "@/lib/prepublish";
import type {
  ClaimStatus,
  DatePrecision,
  FamilyNoteKind,
  LegalStatus,
  PersonRole,
  ProfileBasis,
  SourceKind,
  SourceRating,
} from "@/generated/prisma/enums";

// ---------- helpers ----------

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function required(form: FormData, key: string) {
  const v = str(form, key);
  if (!v) throw new Error(`Missing ${key}`);
  return v;
}

function date(form: FormData, key: string) {
  const v = str(form, key);
  return v ? new Date(`${v}T00:00:00Z`) : null;
}

async function ownedEpisode(episodeId: string) {
  const episode = await db.episode.findUniqueOrThrow({ where: { id: episodeId } });
  await requireCase(episode.caseId);
  return episode;
}

// ---------- cases ----------

export async function createCase(form: FormData) {
  const user = await requireUser();
  const created = await db.case.create({
    data: {
      title: required(form, "title"),
      summary: str(form, "summary"),
      ownerId: user.id,
      // A case always starts with the victim.
      victims: {
        create: {
          name: required(form, "victimName"),
          bornOn: date(form, "bornOn"),
          diedOn: date(form, "diedOn"),
          hometown: str(form, "hometown"),
          profile: required(form, "profile"),
          profileBasis: required(form, "profileBasis") as ProfileBasis,
          photoUrl: str(form, "photoUrl"),
          photoCredit: str(form, "photoCredit"),
        },
      },
    },
  });
  const doNotInclude = str(form, "doNotInclude");
  if (doNotInclude) {
    await db.familyNote.createMany({
      data: doNotInclude
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ caseId: created.id, kind: "DO_NOT_INCLUDE" as const, text })),
    });
  }
  redirect(`/cases/${created.id}`);
}

export async function updateVictim(form: FormData) {
  const victimId = required(form, "victimId");
  const victim = await db.victim.findUniqueOrThrow({ where: { id: victimId } });
  await requireCase(victim.caseId);
  await db.victim.update({
    where: { id: victimId },
    data: {
      name: required(form, "name"),
      bornOn: date(form, "bornOn"),
      diedOn: date(form, "diedOn"),
      hometown: str(form, "hometown"),
      profile: required(form, "profile"),
      profileBasis: required(form, "profileBasis") as ProfileBasis,
      photoUrl: str(form, "photoUrl"),
      photoCredit: str(form, "photoCredit"),
    },
  });
  redirect(`/cases/${victim.caseId}`);
}

// ---------- family notes ----------

export async function addFamilyNote(form: FormData) {
  const caseId = required(form, "caseId");
  await requireCase(caseId);
  await db.familyNote.create({
    data: {
      caseId,
      kind: required(form, "kind") as FamilyNoteKind,
      text: required(form, "text"),
      fromWhom: str(form, "fromWhom"),
      receivedOn: date(form, "receivedOn"),
    },
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteFamilyNote(form: FormData) {
  const note = await db.familyNote.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(note.caseId);
  await db.familyNote.delete({ where: { id: note.id } });
  revalidatePath(`/cases/${note.caseId}`);
}

// ---------- people ----------

export async function addPerson(form: FormData) {
  const caseId = required(form, "caseId");
  await requireCase(caseId);
  await db.person.create({
    data: {
      caseId,
      name: required(form, "name"),
      role: required(form, "role") as PersonRole,
      legalStatus: required(form, "legalStatus") as LegalStatus,
      notes: str(form, "notes"),
    },
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function updatePersonStatus(form: FormData) {
  const person = await db.person.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(person.caseId);
  await db.person.update({
    where: { id: person.id },
    data: { legalStatus: required(form, "legalStatus") as LegalStatus },
  });
  revalidatePath(`/cases/${person.caseId}`);
}

export async function deletePerson(form: FormData) {
  const person = await db.person.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(person.caseId);
  await db.person.delete({ where: { id: person.id } });
  revalidatePath(`/cases/${person.caseId}`);
}

// ---------- sources ----------

const TEXT_TYPES = /^(text\/|application\/(json|xml))/;

export async function addSource(form: FormData) {
  const caseId = required(form, "caseId");
  await requireCase(caseId);
  const type = required(form, "type") as "URL" | "FILE" | "TEXT";
  let filePath: string | null = null;
  let fileName: string | null = null;
  let text = str(form, "text");

  if (type === "FILE") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload");
    // Uploads go to ./uploads (or UPLOAD_DIR). Swap for cloud storage before deploying.
    const dir = path.join(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"), caseId);
    await mkdir(dir, { recursive: true });
    fileName = file.name;
    const stored = `${randomUUID()}${path.extname(file.name)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(/*turbopackIgnore: true*/ dir, stored), bytes);
    filePath = path.join(caseId, stored);
    // Plain-text files are readable by the pre-publish check. PDFs are stored but not read yet.
    if (!text && TEXT_TYPES.test(file.type)) text = bytes.toString("utf8");
  }

  await db.source.create({
    data: {
      caseId,
      title: required(form, "title"),
      type,
      url: type === "URL" ? required(form, "url") : null,
      filePath,
      fileName,
      text,
      rating: required(form, "rating") as SourceRating,
      kind: required(form, "kind") as SourceKind,
      publishedOn: date(form, "publishedOn"),
      notes: str(form, "notes"),
    },
  });
  revalidatePath(`/cases/${caseId}/sources`);
}

export async function updateSourceRating(form: FormData) {
  const source = await db.source.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(source.caseId);
  await db.source.update({
    where: { id: source.id },
    data: { rating: required(form, "rating") as SourceRating },
  });
  revalidatePath(`/cases/${source.caseId}`, "layout");
}

export async function deleteSource(form: FormData) {
  const source = await db.source.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(source.caseId);
  await db.source.delete({ where: { id: source.id } });
  revalidatePath(`/cases/${source.caseId}`, "layout");
}

// ---------- timeline ----------

export async function addTimelineEvent(form: FormData) {
  const caseId = required(form, "caseId");
  await requireCase(caseId);
  const sourceIds = form.getAll("sourceIds").map(String);
  await db.timelineEvent.create({
    data: {
      caseId,
      date: date(form, "date")!,
      datePrecision: (str(form, "datePrecision") ?? "DAY") as DatePrecision,
      title: required(form, "title"),
      description: str(form, "description"),
      sources: { create: sourceIds.map((sourceId) => ({ sourceId })) },
    },
  });
  revalidatePath(`/cases/${caseId}/timeline`);
}

export async function updateEventSources(form: FormData) {
  const event = await db.timelineEvent.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(event.caseId);
  const sourceIds = form.getAll("sourceIds").map(String);
  await db.$transaction([
    db.timelineEventSource.deleteMany({ where: { eventId: event.id } }),
    db.timelineEventSource.createMany({ data: sourceIds.map((sourceId) => ({ eventId: event.id, sourceId })) }),
  ]);
  revalidatePath(`/cases/${event.caseId}/timeline`);
}

export async function deleteTimelineEvent(form: FormData) {
  const event = await db.timelineEvent.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(event.caseId);
  await db.timelineEvent.delete({ where: { id: event.id } });
  revalidatePath(`/cases/${event.caseId}/timeline`);
}

// ---------- episodes ----------

export async function createEpisode(form: FormData) {
  const caseId = required(form, "caseId");
  await requireCase(caseId);
  const episode = await db.episode.create({
    data: { caseId, title: required(form, "title"), script: str(form, "script") ?? "" },
  });
  redirect(`/cases/${caseId}/episodes/${episode.id}`);
}

export async function saveScript(form: FormData) {
  const episode = await ownedEpisode(required(form, "episodeId"));
  const script = String(form.get("script") ?? "");
  await db.episode.update({
    where: { id: episode.id },
    // Editing the script means the last check no longer applies.
    data: { script, status: script === episode.script ? episode.status : "DRAFT" },
  });
  revalidatePath(`/cases/${episode.caseId}/episodes/${episode.id}`);
}

export type AiState = { error?: string; ok?: boolean };

export async function runCheck(_prev: AiState, form: FormData): Promise<AiState> {
  const episode = await ownedEpisode(required(form, "episodeId"));
  const script = form.get("script");
  if (typeof script === "string" && script !== episode.script) {
    await db.episode.update({ where: { id: episode.id }, data: { script } });
  }
  if (!(typeof script === "string" ? script : episode.script).trim()) return { error: "Paste a script first." };
  try {
    await checkEpisode(episode.id);
  } catch (err) {
    if (err instanceof AiError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/cases/${episode.caseId}/episodes/${episode.id}`);
  return { ok: true };
}

export async function runDraft(_prev: AiState, form: FormData): Promise<AiState> {
  const episode = await ownedEpisode(required(form, "episodeId"));
  try {
    const { context } = await loadCaseContext(episode.caseId);
    const script = await draftScript(context, episode.title);
    await db.episode.update({ where: { id: episode.id }, data: { script, status: "DRAFT" } });
  } catch (err) {
    if (err instanceof AiError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/cases/${episode.caseId}/episodes/${episode.id}`);
  return { ok: true };
}

export async function markReady(form: FormData) {
  const episode = await ownedEpisode(required(form, "episodeId"));
  const open = await db.flag.count({ where: { episodeId: episode.id, status: "OPEN" } });
  if (episode.status !== "CHECKED" || open > 0 || (episode.unsourcedCount ?? 0) > 0) {
    throw new Error("Resolve every open flag and unsourced claim before marking ready.");
  }
  await db.episode.update({ where: { id: episode.id }, data: { status: "READY" } });
  revalidatePath(`/cases/${episode.caseId}/episodes/${episode.id}`);
}

// ---------- claims and flags ----------

export async function updateClaim(form: FormData) {
  const claim = await db.claim.findUniqueOrThrow({ where: { id: required(form, "id") } });
  await requireCase(claim.caseId);
  const sourceIds = form.getAll("sourceIds").map(String);
  await db.$transaction([
    db.claim.update({ where: { id: claim.id }, data: { status: required(form, "status") as ClaimStatus } }),
    db.claimSource.deleteMany({ where: { claimId: claim.id } }),
    db.claimSource.createMany({ data: sourceIds.map((sourceId) => ({ claimId: claim.id, sourceId })) }),
  ]);
  if (claim.episodeId) {
    await rescoreEpisode(claim.episodeId);
    revalidatePath(`/cases/${claim.caseId}/episodes/${claim.episodeId}`);
  }
}

export async function resolveFlag(form: FormData) {
  const flag = await db.flag.findUniqueOrThrow({ where: { id: required(form, "id") } });
  const episode = await ownedEpisode(flag.episodeId);
  const action = required(form, "action");

  if (action === "apply" && flag.suggestedRewrite !== null && episode.script.includes(flag.excerpt)) {
    await db.episode.update({
      where: { id: episode.id },
      data: { script: episode.script.replace(flag.excerpt, flag.suggestedRewrite) },
    });
  }
  if (action === "dismiss") {
    const note = str(form, "dismissNote");
    if (!note) throw new Error("Say why you are dismissing this flag.");
    await db.flag.update({ where: { id: flag.id }, data: { status: "DISMISSED", dismissNote: note } });
  } else {
    await db.flag.update({ where: { id: flag.id }, data: { status: "FIXED" } });
  }
  revalidatePath(`/cases/${episode.caseId}/episodes/${episode.id}`);
}
