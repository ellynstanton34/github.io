import Link from "next/link";
import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { createEpisode } from "@/app/cases/actions";
import { Badge } from "@/components/badge";
import { ScoreBadge } from "@/components/score";
import { SubmitButton } from "@/components/submit-button";

export default async function EpisodesPage({ params }: PageProps<"/cases/[caseId]/episodes">) {
  const { caseId } = await params;
  await requireCase(caseId);
  const episodes = await db.episode.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { flags: { where: { status: "OPEN" } } } } },
  });

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {episodes.map((e) => (
          <li key={e.id}>
            <Link
              href={`/cases/${caseId}/episodes/${e.id}`}
              className="card flex flex-wrap items-center justify-between gap-3 hover:border-accent"
            >
              <div>
                <p className="font-medium">{e.title}</p>
                <p className="muted">
                  {e.lastCheckedAt ? `Checked ${e.lastCheckedAt.toLocaleDateString("en-US")}` : "Not checked yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {e._count.flags > 0 && <Badge tone="warn">{e._count.flags} open flags</Badge>}
                {(e.unsourcedCount ?? 0) > 0 && <Badge tone="warn">{e.unsourcedCount} with no source</Badge>}
                <Badge tone={e.status === "READY" ? "strong" : "neutral"}>{e.status.toLowerCase()}</Badge>
                <ScoreBadge score={e.sourcingScore} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <form action={createEpisode} className="card space-y-3">
        <h2 className="font-semibold">New episode</h2>
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="e.g. Episode 1: Who June was" />
        </div>
        <div>
          <label className="label">Script (optional)</label>
          <textarea
            name="script"
            rows={5}
            className="input"
            placeholder="Paste a script to check it, or leave empty and draft one from your timeline on the next screen."
          />
        </div>
        <SubmitButton>Create episode</SubmitButton>
      </form>
    </div>
  );
}
