import type { CheckResult } from "@/lib/ai";
import type { FamilyNote, Person, Source } from "@/generated/prisma/client";
import type { FlagKind } from "@/generated/prisma/enums";
import { legalLabel } from "@/lib/labels";
import { onlyWeakSources } from "@/lib/scoring";

// The rules for what gets flagged. Claude finds the claims and matches them to sources;
// these rules decide, so every flag's reason reflects your own source ratings and people list.

export type NewFlag = {
  kind: FlagKind;
  excerpt: string;
  reason: string;
  suggestedRewrite: string | null;
  personId?: string;
  familyNoteId?: string;
  claimIndex?: number;
};

export function buildFlags(
  result: CheckResult,
  people: Pick<Person, "id" | "name" | "legalStatus">[],
  familyNotes: Pick<FamilyNote, "id" | "text">[],
  sourceByRef: Map<string, Source>,
) {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const notesById = new Map(familyNotes.map((n) => [n.id, n]));
  const flags: NewFlag[] = [];

  const claims = result.claims.map((claim, index) => {
    const sources = [...new Set(claim.sourceRefs)].map((ref) => sourceByRef.get(ref)).filter((s) => s !== undefined);

    if (sources.length === 0) {
      flags.push({
        kind: "NO_SOURCE",
        excerpt: claim.excerpt,
        reason: "No source in this case file supports this claim. Add a source or cut it.",
        suggestedRewrite: claim.saferRewrite,
        claimIndex: index,
      });
    } else if (claim.statedAsFact && onlyWeakSources(sources)) {
      const titles = sources.map((s) => `"${s.title}"`).join(", ");
      flags.push({
        kind: "WEAK_SOURCE_AS_FACT",
        excerpt: claim.excerpt,
        reason: `Stated as fact, but the only support is rated Weak: ${titles}.`,
        suggestedRewrite: claim.saferRewrite,
        claimIndex: index,
      });
    }

    const mentioned = claim.people.filter((p) => peopleById.has(p.personId));
    for (const mention of mentioned) {
      const person = peopleById.get(mention.personId)!;
      if (!mention.describedAsGuilty || person.legalStatus === "CONVICTED") continue;
      flags.push({
        kind: "UNCHARGED_NAMED_GUILTY",
        excerpt: claim.excerpt,
        reason:
          person.legalStatus === "CHARGED"
            ? `${person.name} is charged, not convicted. Describe them as accused.`
            : `${person.name} is ${legalLabel[person.legalStatus].toLowerCase()}. The script describes or implies they are guilty.`,
        suggestedRewrite: claim.saferRewrite,
        personId: person.id,
        claimIndex: index,
      });
    }

    return { claim, sources, people: mentioned };
  });

  for (const conflict of result.familyConflicts) {
    const note = notesById.get(conflict.familyNoteId);
    if (!note) continue;
    flags.push({
      kind: "FAMILY_REQUEST",
      excerpt: conflict.excerpt,
      reason: `${conflict.reason} Family note: "${note.text}"`,
      suggestedRewrite: conflict.suggestedRewrite, // "" means cut the passage
      familyNoteId: note.id,
    });
  }

  for (const unlisted of result.unlistedPeopleDescribedAsGuilty) {
    flags.push({
      kind: "UNCHARGED_NAMED_GUILTY",
      excerpt: unlisted.excerpt,
      reason: `${unlisted.name} is not in your People list, so they are treated as uncharged. The script describes them as guilty.`,
      suggestedRewrite: unlisted.suggestedRewrite,
    });
  }

  return { flags, claims };
}
