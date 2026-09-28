import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { markReady, resolveFlag, updateClaim } from "@/app/cases/actions";
import { Badge, claimTone, ratingTone } from "@/components/badge";
import { ScriptEditor } from "@/components/script-editor";
import { scoreTone } from "@/components/score";
import { SubmitButton } from "@/components/submit-button";
import { claimStatusLabel, flagKindLabel, ratingLabel, sourceRef } from "@/lib/labels";
import { claimPoints } from "@/lib/scoring";

// Splits the script so flagged excerpts can be highlighted.
function highlight(script: string, excerpts: string[]) {
  const found = excerpts.filter((e) => e && script.includes(e));
  if (found.length === 0) return [{ text: script, flagged: false }];
  const escaped = found.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return script
    .split(new RegExp(`(${escaped.join("|")})`, "g"))
    .filter(Boolean)
    .map((text) => ({ text, flagged: found.includes(text) }));
}

export default async function EpisodePage({ params }: PageProps<"/cases/[caseId]/episodes/[episodeId]">) {
  const { caseId, episodeId } = await params;
  await requireCase(caseId);
  const episode = await db.episode.findFirst({
    where: { id: episodeId, caseId },
    include: {
      flags: { orderBy: { createdAt: "asc" } },
      claims: { orderBy: { createdAt: "asc" }, include: { sources: { include: { source: true } } } },
    },
  });
  if (!episode) notFound();
  const sources = await db.source.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } });
  const refs = new Map(sources.map((s, i) => [s.id, sourceRef(i)]));

  const openFlags = episode.flags.filter((f) => f.status === "OPEN");
  const closedFlags = episode.flags.filter((f) => f.status !== "OPEN");
  const unsourced = episode.unsourcedCount ?? 0;
  const canMarkReady = episode.status === "CHECKED" && openFlags.length === 0 && unsourced === 0;
  const parts = highlight(episode.script, openFlags.map((f) => f.excerpt));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{episode.title}</h2>
          <p className="muted">
            {episode.status === "READY"
              ? "Marked ready to publish."
              : episode.lastCheckedAt
                ? `Last checked ${episode.lastCheckedAt.toLocaleString("en-US")}`
                : "Not checked yet."}
            {episode.status === "DRAFT" && episode.lastCheckedAt && " Script changed since the last check."}
          </p>
        </div>
        {episode.status === "READY" ? (
          <Badge tone="strong">Ready to publish</Badge>
        ) : (
          <form action={markReady}>
            <input type="hidden" name="episodeId" value={episode.id} />
            {canMarkReady ? (
              <SubmitButton pendingText="...">Mark ready to publish</SubmitButton>
            ) : (
              <button className="btn-quiet" disabled title="Run the check and clear every flag and unsourced claim first">
                Mark ready to publish
              </button>
            )}
          </form>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="muted">Sourcing score</p>
          <p className={`text-3xl font-semibold tabular-nums ${scoreTone(episode.sourcingScore)}`}>
            {episode.sourcingScore ?? "--"}
            <span className="text-base font-normal text-stone-400">/100</span>
          </p>
          <p className="muted">{episode.claims.length} claims found</p>
        </div>
        <div className={`card ${unsourced > 0 ? "border-warn/50 bg-warn-soft" : ""}`}>
          <p className="muted">Claims with no source</p>
          <p className={`text-3xl font-semibold tabular-nums ${unsourced > 0 ? "text-warn" : ""}`}>
            {episode.unsourcedCount ?? "--"}
          </p>
        </div>
        <div className={`card ${openFlags.length > 0 ? "border-warn/50 bg-warn-soft" : ""}`}>
          <p className="muted">Open flags</p>
          <p className={`text-3xl font-semibold tabular-nums ${openFlags.length > 0 ? "text-warn" : ""}`}>
            {openFlags.length}
          </p>
          {!canMarkReady && episode.status !== "READY" && episode.lastCheckedAt && (
            <p className="muted">Clear these to mark ready.</p>
          )}
        </div>
      </div>

      <ScriptEditor episodeId={episode.id} script={episode.script} />

      {openFlags.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Flags</h3>
          <div className="card max-h-80 overflow-y-auto whitespace-pre-line font-serif text-[15px] leading-relaxed">
            {parts.map((p, i) =>
              p.flagged ? (
                <mark key={i} className="rounded bg-warn-soft px-0.5 text-warn underline decoration-warn/60">
                  {p.text}
                </mark>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </div>
          <ul className="space-y-3">
            {openFlags.map((f) => (
              <li key={f.id} className="card space-y-3 border-l-4 border-l-warn">
                <Badge tone="warn">{flagKindLabel[f.kind]}</Badge>
                <blockquote className="border-l-2 border-stone-200 pl-3 font-serif italic">{f.excerpt}</blockquote>
                <p className="text-sm">{f.reason}</p>
                {f.suggestedRewrite !== null && (
                  <div className="rounded-md bg-accent-soft p-3 text-sm">
                    <p className="mb-1 font-medium text-accent">Suggested rewrite</p>
                    <p className="font-serif">{f.suggestedRewrite || "(Cut this passage.)"}</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {f.suggestedRewrite !== null && episode.script.includes(f.excerpt) && (
                    <form action={resolveFlag}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="action" value="apply" />
                      <SubmitButton pendingText="Applying...">{f.suggestedRewrite ? "Apply rewrite" : "Cut passage"}</SubmitButton>
                    </form>
                  )}
                  <form action={resolveFlag}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="action" value="fixed" />
                    <SubmitButton quiet pendingText="...">I fixed it myself</SubmitButton>
                  </form>
                  <form action={resolveFlag} className="flex flex-1 gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="action" value="dismiss" />
                    <input name="dismissNote" required placeholder="Why this is fine" className="input min-w-40 py-1.5" />
                    <SubmitButton quiet pendingText="...">Dismiss</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {episode.claims.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold">Claims</h3>
            <p className="muted">
              Found by the last check. Adjust a status or its sources and the score updates. Points: Primary or 2+
              Reliable = 100, one Reliable = 60, Weak only = 20, none = 0. Rumors max out at 20.
            </p>
          </div>
          <ul className="space-y-2">
            {episode.claims.map((c) => {
              const linked = c.sources.map((cs) => cs.source);
              const selected = new Set(linked.map((s) => s.id));
              return (
                <li key={c.id} className={`card space-y-2 py-3 ${linked.length === 0 ? "border-warn/50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p>{c.text}</p>
                    <span className="shrink-0 text-sm tabular-nums text-stone-500">
                      {claimPoints(c.status, linked)} pts
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={claimTone[c.status]}>{claimStatusLabel[c.status]}</Badge>
                    {linked.length === 0 && <Badge tone="warn">No source</Badge>}
                    {linked.map((s) => (
                      <Badge key={s.id} tone={ratingTone[s.rating]}>
                        {refs.get(s.id)} {s.title}
                      </Badge>
                    ))}
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-stone-500">Edit</summary>
                    <form action={updateClaim} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="status" defaultValue={c.status} className="input max-w-48 py-1">
                        {Object.entries(claimStatusLabel).map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                      <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                        {sources.map((s) => (
                          <label key={s.id} className="flex items-start gap-2">
                            <input type="checkbox" name="sourceIds" value={s.id} defaultChecked={selected.has(s.id)} className="mt-1" />
                            <span>
                              <span className="font-mono text-xs text-stone-400">{refs.get(s.id)}</span> {s.title}{" "}
                              <span className="text-stone-400">({ratingLabel[s.rating]})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <SubmitButton quiet>Save claim</SubmitButton>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {closedFlags.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer text-stone-500">{closedFlags.length} resolved flags</summary>
          <ul className="mt-3 space-y-2">
            {closedFlags.map((f) => (
              <li key={f.id} className="border-t border-stone-100 pt-2">
                <span className="font-medium">{f.status === "FIXED" ? "Fixed" : "Dismissed"}:</span>{" "}
                {flagKindLabel[f.kind]}. &quot;{f.excerpt}&quot;
                {f.dismissNote && <span className="text-stone-500"> Note: {f.dismissNote}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
