import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { addTimelineEvent, deleteTimelineEvent, updateEventSources } from "@/app/cases/actions";
import { Badge, ratingTone } from "@/components/badge";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, precisionLabel, ratingLabel, sourceRef } from "@/lib/labels";
import { timelineLabel } from "@/lib/scoring";

export default async function TimelinePage({ params }: PageProps<"/cases/[caseId]/timeline">) {
  const { caseId } = await params;
  await requireCase(caseId);
  const [events, sources] = await Promise.all([
    db.timelineEvent.findMany({
      where: { caseId },
      orderBy: { date: "asc" },
      include: { sources: { include: { source: true } } },
    }),
    db.source.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } }),
  ]);
  const refs = new Map(sources.map((s, i) => [s.id, sourceRef(i)]));
  const unverified = events.filter((e) => e.sources.length === 0).length;

  const sourcePicker = (selected: Set<string>) => (
    <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
      {sources.map((s) => (
        <label key={s.id} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="sourceIds" value={s.id} defaultChecked={selected.has(s.id)} className="mt-1" />
          <span>
            <span className="font-mono text-xs text-stone-400">{refs.get(s.id)}</span> {s.title}{" "}
            <span className="text-stone-400">({ratingLabel[s.rating]})</span>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="muted">
        {events.length} events
        {unverified > 0 && <span className="text-warn"> · {unverified} unverified</span>}
      </p>

      <ol className="relative space-y-4 border-l-2 border-stone-200 pl-6">
        {events.map((e) => {
          const label = timelineLabel(e.sources.map((es) => es.source));
          return (
            <li key={e.id} className="relative">
              <span
                className={`absolute -left-[31px] top-5 h-3 w-3 rounded-full ${label.tone === "warn" ? "bg-warn" : "bg-accent"}`}
              />
              <div className={`card space-y-2 ${label.tone === "warn" ? "border-warn/40" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-stone-500">{formatDate(e.date, e.datePrecision)}</p>
                  <Badge tone={label.tone}>{label.text}</Badge>
                </div>
                <p className="font-semibold">{e.title}</p>
                {e.description && <p className="text-sm leading-relaxed">{e.description}</p>}
                {e.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {e.sources.map(({ source }) => (
                      <Badge key={source.id} tone={ratingTone[source.rating]}>
                        {refs.get(source.id)} {source.title}
                      </Badge>
                    ))}
                  </div>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer text-stone-500">Edit sources</summary>
                  <form action={updateEventSources} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={e.id} />
                    {sourcePicker(new Set(e.sources.map((es) => es.sourceId)))}
                    <div className="flex justify-between">
                      <SubmitButton quiet>Save sources</SubmitButton>
                    </div>
                  </form>
                  <form action={deleteTimelineEvent} className="mt-2">
                    <input type="hidden" name="id" value={e.id} />
                    <button className="text-stone-400 hover:text-warn">Delete event</button>
                  </form>
                </details>
              </div>
            </li>
          );
        })}
      </ol>

      <form action={addTimelineEvent} className="card space-y-3">
        <h2 className="font-semibold">Add an event</h2>
        <input type="hidden" name="caseId" value={caseId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Date</label>
            <input name="date" type="date" required className="input" />
          </div>
          <div>
            <label className="label">How exact</label>
            <select name="datePrecision" className="input" defaultValue="DAY">
              {Object.entries(precisionLabel).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label">What happened</label>
            <input name="title" required className="input" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Details</label>
            <textarea name="description" rows={3} className="input" />
          </div>
        </div>
        <div>
          <p className="label">Sources for this event</p>
          {sources.length ? sourcePicker(new Set()) : <p className="muted">Add sources first.</p>}
          <p className="muted mt-1">An event with no sources shows as Unverified.</p>
        </div>
        <SubmitButton>Add event</SubmitButton>
      </form>
    </div>
  );
}
