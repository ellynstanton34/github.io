import Link from "next/link";
import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { addFamilyNote, addPerson, deleteFamilyNote, deletePerson, updatePersonStatus } from "@/app/cases/actions";
import { Badge } from "@/components/badge";
import { SubmitButton } from "@/components/submit-button";
import { basisLabel, familyNoteLabel, formatDate, legalLabel, roleLabel } from "@/lib/labels";

export default async function CasePage({ params }: PageProps<"/cases/[caseId]">) {
  const { caseId } = await params;
  await requireCase(caseId);
  const c = await db.case.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      victims: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      familyNotes: { orderBy: [{ kind: "asc" }, { createdAt: "asc" }] },
      people: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <div className="space-y-8">
      {/* Victim first, always. */}
      {c.victims.map((v) => (
        <section key={v.id} className="card flex flex-col gap-5 sm:flex-row">
          <div className="flex h-40 w-32 shrink-0 flex-col items-center justify-center overflow-hidden rounded-md bg-stone-100 text-center text-xs text-stone-400">
            {v.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.photoUrl} alt={v.name} className="h-full w-full object-cover" />
            ) : (
              <span className="px-2">Photo placeholder</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">{v.name}</h2>
              <Link href={`/cases/${caseId}/victim`} className="text-sm text-accent underline">Edit</Link>
            </div>
            <p className="muted">
              {[v.bornOn && `Born ${formatDate(v.bornOn)}`, v.diedOn && `Died ${formatDate(v.diedOn)}`, v.hometown]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="whitespace-pre-line leading-relaxed">{v.profile}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge tone={v.profileBasis === "OTHER" ? "warn" : "ok"}>{basisLabel[v.profileBasis]}</Badge>
              {v.photoCredit && <span className="muted">Photo: {v.photoCredit}</span>}
            </div>
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Family notes</h2>
          <p className="muted">&quot;Do not include&quot; notes are checked against every script before you publish.</p>
        </div>
        <ul className="space-y-2">
          {c.familyNotes.map((n) => (
            <li key={n.id} className="card flex items-start justify-between gap-4 py-3">
              <div className="space-y-1">
                <Badge tone={n.kind === "DO_NOT_INCLUDE" ? "warn" : "neutral"}>{familyNoteLabel[n.kind]}</Badge>
                <p>{n.text}</p>
                {(n.fromWhom || n.receivedOn) && (
                  <p className="muted">
                    {[n.fromWhom, n.receivedOn && formatDate(n.receivedOn)].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <form action={deleteFamilyNote}>
                <input type="hidden" name="id" value={n.id} />
                <button className="text-sm text-stone-400 hover:text-warn">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addFamilyNote} className="card grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="caseId" value={caseId} />
          <select name="kind" className="input sm:col-span-2" defaultValue="DO_NOT_INCLUDE">
            {Object.entries(familyNoteLabel).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <input name="fromWhom" placeholder="From (e.g. her mother)" className="input sm:col-span-2" />
          <input name="receivedOn" type="date" className="input sm:col-span-2" />
          <textarea name="text" required rows={2} placeholder="What they asked" className="input sm:col-span-6" />
          <div className="sm:col-span-6">
            <SubmitButton>Add note</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">People</h2>
          <p className="muted">
            Legal status drives the guilt check. Only someone marked Convicted may be described as having done it.
          </p>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Legal status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {c.people.map((p) => (
                <tr key={p.id} className="border-t border-stone-100 align-top">
                  <td className="px-4 py-2">
                    <p className="font-medium">{p.name}</p>
                    {p.notes && <p className="muted">{p.notes}</p>}
                  </td>
                  <td className="px-4 py-2">{roleLabel[p.role]}</td>
                  <td className="px-4 py-2">
                    <form action={updatePersonStatus} className="flex gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="legalStatus" defaultValue={p.legalStatus} className="input min-w-32 py-1">
                        {Object.entries(legalLabel).map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                      <SubmitButton quiet pendingText="...">Save</SubmitButton>
                    </form>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={deletePerson}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-stone-400 hover:text-warn">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={addPerson} className="card grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="caseId" value={caseId} />
          <input name="name" required placeholder="Name" className="input sm:col-span-2" />
          <select name="role" className="input sm:col-span-2" defaultValue="OTHER">
            {Object.entries(roleLabel).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <select name="legalStatus" className="input sm:col-span-2" defaultValue="UNCHARGED">
            {Object.entries(legalLabel).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <input name="notes" placeholder="Notes (optional)" className="input sm:col-span-6" />
          <div className="sm:col-span-6">
            <SubmitButton>Add person</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
