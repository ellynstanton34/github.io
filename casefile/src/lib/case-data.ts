import "server-only";
import { db } from "@/lib/db";
import type { CaseContext } from "@/lib/ai";
import { formatDate, sourceRef } from "@/lib/labels";
import { timelineLabel } from "@/lib/scoring";

// Loads everything about a case that the AI steps need, with stable source refs (S1, S2, ...).
export async function loadCaseContext(caseId: string) {
  const c = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      victims: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      familyNotes: { orderBy: { createdAt: "asc" } },
      people: { orderBy: { createdAt: "asc" } },
      sources: { orderBy: { createdAt: "asc" } },
      timelineEvents: {
        orderBy: { date: "asc" },
        include: { sources: { include: { source: true } } },
      },
    },
  });

  const refById = new Map(c.sources.map((s, i) => [s.id, sourceRef(i)]));
  const sourceByRef = new Map(c.sources.map((s, i) => [sourceRef(i), s]));

  const context: CaseContext = {
    title: c.title,
    victims: c.victims.map((v) => ({
      name: v.name,
      profile: v.profile,
      basis: v.profileBasis,
      born: v.bornOn ? formatDate(v.bornOn) : undefined,
      died: v.diedOn ? formatDate(v.diedOn) : undefined,
      hometown: v.hometown ?? undefined,
    })),
    familyNotes: c.familyNotes.map((n) => ({
      id: n.id,
      kind: n.kind,
      text: n.text,
      fromWhom: n.fromWhom ?? undefined,
    })),
    people: c.people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      legalStatus: p.legalStatus,
      notes: p.notes ?? undefined,
    })),
    sources: c.sources.map((s, i) => ({
      ref: sourceRef(i),
      title: s.title,
      rating: s.rating,
      kind: s.kind,
      url: s.url ?? undefined,
      text: s.text ?? undefined,
      notes: s.notes ?? undefined,
    })),
    events: c.timelineEvents.map((e) => ({
      date: formatDate(e.date, e.datePrecision),
      title: e.title,
      description: e.description ?? undefined,
      sourceRefs: e.sources.map((es) => refById.get(es.sourceId)!).filter(Boolean),
      label: timelineLabel(e.sources.map((es) => es.source)).text,
    })),
  };

  return { case: c, context, refById, sourceByRef };
}
