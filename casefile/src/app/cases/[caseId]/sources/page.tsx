import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { deleteSource, updateSourceRating } from "@/app/cases/actions";
import { Badge, ratingTone } from "@/components/badge";
import { SourceForm } from "@/components/source-form";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, kindLabel, ratingLabel, sourceRef } from "@/lib/labels";

export default async function SourcesPage({ params }: PageProps<"/cases/[caseId]/sources">) {
  const { caseId } = await params;
  await requireCase(caseId);
  const sources = await db.source.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { events: true, claims: true } } },
  });
  const counts = {
    PRIMARY: sources.filter((s) => s.rating === "PRIMARY").length,
    RELIABLE: sources.filter((s) => s.rating === "RELIABLE").length,
    WEAK: sources.filter((s) => s.rating === "WEAK").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="muted mr-2">{sources.length} sources</p>
        <Badge tone="strong">{counts.PRIMARY} Primary</Badge>
        <Badge tone="ok">{counts.RELIABLE} Reliable</Badge>
        <Badge tone="warn">{counts.WEAK} Weak</Badge>
      </div>

      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={s.id} className="card space-y-2 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  <span className="mr-2 font-mono text-xs text-stone-400">{sourceRef(i)}</span>
                  {s.title}
                </p>
                <p className="muted">
                  {[
                    kindLabel[s.kind],
                    s.publishedOn && formatDate(s.publishedOn),
                    `${s._count.events} events`,
                    `${s._count.claims} claims`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={ratingTone[s.rating]}>{ratingLabel[s.rating]}</Badge>
                <form action={updateSourceRating} className="flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  <select name="rating" defaultValue={s.rating} className="input py-1 text-xs">
                    {Object.entries(ratingLabel).map(([value, text]) => (
                      <option key={value} value={value}>{text}</option>
                    ))}
                  </select>
                  <SubmitButton quiet pendingText="...">Rate</SubmitButton>
                </form>
              </div>
            </div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-accent underline">
                {s.url}
              </a>
            )}
            {s.fileName && <p className="text-sm">File: {s.fileName}</p>}
            {s.text && (
              <details className="text-sm">
                <summary className="cursor-pointer text-stone-500">Text on file</summary>
                <p className="mt-2 whitespace-pre-line rounded bg-stone-50 p-3">{s.text}</p>
              </details>
            )}
            {s.notes && <p className="muted">Notes: {s.notes}</p>}
            <form action={deleteSource} className="text-right">
              <input type="hidden" name="id" value={s.id} />
              <button className="text-sm text-stone-400 hover:text-warn">Remove</button>
            </form>
          </li>
        ))}
      </ul>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Add a source</h2>
        <SourceForm caseId={caseId} />
      </div>
    </div>
  );
}
