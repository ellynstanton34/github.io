import type { ClaimStatus, SourceKind, SourceRating } from "@/generated/prisma/enums";

// Sourcing rules. Change the numbers here and every screen follows.

type RatedSource = { rating: SourceRating; kind?: SourceKind };

// Points for one claim, 0 to 100.
// 100: a Primary source, or two or more Reliable. 60: one Reliable. 20: Weak only. 0: none.
// A Rumor is capped at 20 no matter how well sourced.
export function claimPoints(status: ClaimStatus, sources: RatedSource[]) {
  const primary = sources.filter((s) => s.rating === "PRIMARY").length;
  const reliable = sources.filter((s) => s.rating === "RELIABLE").length;
  let points = 0;
  if (primary > 0 || reliable >= 2) points = 100;
  else if (reliable === 1) points = 60;
  else if (sources.length > 0) points = 20;
  if (status === "RUMOR") points = Math.min(points, 20);
  return points;
}

export function episodeScore(claims: { status: ClaimStatus; sources: RatedSource[] }[]) {
  const unsourced = claims.filter((c) => c.sources.length === 0).length;
  if (claims.length === 0) return { score: null, unsourced, total: 0 };
  const sum = claims.reduce((acc, c) => acc + claimPoints(c.status, c.sources), 0);
  return { score: Math.round(sum / claims.length), unsourced, total: claims.length };
}

// Only-weak means every linked source is Weak (or there are none).
export function onlyWeakSources(sources: RatedSource[]) {
  return sources.every((s) => s.rating === "WEAK");
}

// Label for a timeline event: "Court doc", "2 sources", "1 source" or "Unverified".
export function timelineLabel(sources: RatedSource[]) {
  if (sources.length === 0) return { text: "Unverified", tone: "warn" as const };
  if (sources.some((s) => s.kind === "COURT_DOC")) return { text: "Court doc", tone: "strong" as const };
  if (sources.some((s) => s.kind === "POLICE_RECORD")) return { text: "Police record", tone: "strong" as const };
  const tone = onlyWeakSources(sources) ? ("warn" as const) : ("ok" as const);
  const text = sources.length === 1 ? "1 source" : `${sources.length} sources`;
  return { text: onlyWeakSources(sources) ? `${text}, weak only` : text, tone };
}
