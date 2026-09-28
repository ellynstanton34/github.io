import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { updateVictim } from "@/app/cases/actions";
import { SubmitButton } from "@/components/submit-button";
import { VictimFields } from "@/components/victim-fields";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

export default async function EditVictimPage({ params }: PageProps<"/cases/[caseId]/victim">) {
  const { caseId } = await params;
  await requireCase(caseId);
  const v = await db.victim.findFirstOrThrow({ where: { caseId, isPrimary: true } });
  return (
    <form action={updateVictim} className="card max-w-2xl space-y-4">
      <input type="hidden" name="victimId" value={v.id} />
      <VictimFields v={{ ...v, bornOn: iso(v.bornOn), diedOn: iso(v.diedOn) }} />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
