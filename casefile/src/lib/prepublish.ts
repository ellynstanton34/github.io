import "server-only";
import { db } from "@/lib/db";
import { runPrePublishCheck } from "@/lib/ai";
import { loadCaseContext } from "@/lib/case-data";
import { buildFlags } from "@/lib/flag-rules";
import { episodeScore } from "@/lib/scoring";

// Runs the pre-publish check on an episode's script and saves claims, flags and the score.
export async function checkEpisode(episodeId: string) {
  const episode = await db.episode.findUniqueOrThrow({ where: { id: episodeId } });
  const { case: c, context, sourceByRef } = await loadCaseContext(episode.caseId);
  const result = await runPrePublishCheck(context, episode.script);

  const { flags, claims } = buildFlags(result, c.people, c.familyNotes, sourceByRef);

  const score = episodeScore(claims.map((x) => ({ status: x.claim.suggestedStatus, sources: x.sources })));

  await db.$transaction(async (tx) => {
    // Keep flags you dismissed, so the same issue does not come back on every run.
    const dismissed = await tx.flag.findMany({ where: { episodeId, status: "DISMISSED" } });
    const dismissedKeys = new Set(dismissed.map((f) => `${f.kind}|${f.excerpt}`));

    await tx.flag.deleteMany({ where: { episodeId, status: { not: "DISMISSED" } } });
    await tx.claim.deleteMany({ where: { episodeId } });

    const claimIds: string[] = [];
    for (const { claim, sources, people } of claims) {
      const created = await tx.claim.create({
        data: {
          caseId: c.id,
          episodeId,
          text: claim.claim,
          status: claim.suggestedStatus,
          sources: { create: sources.map((s) => ({ sourceId: s.id })) },
          people: { connect: people.map((p) => ({ id: p.personId })) },
        },
      });
      claimIds.push(created.id);
    }

    for (const f of flags) {
      if (dismissedKeys.has(`${f.kind}|${f.excerpt}`)) continue;
      await tx.flag.create({
        data: {
          episodeId,
          kind: f.kind,
          excerpt: f.excerpt,
          reason: f.reason,
          suggestedRewrite: f.suggestedRewrite,
          personId: f.personId,
          familyNoteId: f.familyNoteId,
          claimId: f.claimIndex !== undefined ? claimIds[f.claimIndex] : undefined,
        },
      });
    }

    await tx.episode.update({
      where: { id: episodeId },
      data: {
        status: "CHECKED",
        sourcingScore: score.score,
        unsourcedCount: score.unsourced,
        lastCheckedAt: new Date(),
      },
    });
  });
}

// Recomputes the score after you edit a claim's status or sources by hand.
export async function rescoreEpisode(episodeId: string) {
  const claims = await db.claim.findMany({
    where: { episodeId },
    include: { sources: { include: { source: true } } },
  });
  const score = episodeScore(claims.map((c) => ({ status: c.status, sources: c.sources.map((cs) => cs.source) })));
  await db.episode.update({
    where: { id: episodeId },
    data: { sourcingScore: score.score, unsourcedCount: score.unsourced },
  });
}
