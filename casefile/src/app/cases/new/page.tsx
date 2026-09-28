import { requireUser } from "@/lib/auth";
import { createCase } from "@/app/cases/actions";
import { SubmitButton } from "@/components/submit-button";
import { VictimFields } from "@/components/victim-fields";

export default async function NewCasePage() {
  await requireUser();
  return (
    <form action={createCase} className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New case</h1>

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Start with the victim</h2>
          <p className="muted">Write from family or primary sources. This comes first on every case page.</p>
        </div>
        <VictimFields nameField="victimName" />
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">The case</h2>
        <div>
          <label className="label">Case title</label>
          <input name="title" required className="input" placeholder="e.g. The disappearance of June Harlow" />
        </div>
        <div>
          <label className="label">Short summary (optional)</label>
          <textarea name="summary" rows={3} className="input" />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Family requests</h2>
        <p className="muted">
          Anything the family asked you to leave out, one per line. Every script is checked against these. You can add
          more later.
        </p>
        <textarea name="doNotInclude" rows={3} className="input" />
      </section>

      <SubmitButton pendingText="Creating...">Create case</SubmitButton>
    </form>
  );
}
