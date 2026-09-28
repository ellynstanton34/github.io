import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/labels";

export default async function Home() {
  const user = await requireUser();
  const cases = await db.case.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      victims: { where: { isPrimary: true }, take: 1 },
      _count: { select: { sources: true, timelineEvents: true, episodes: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your cases</h1>
        <Link href="/cases/new" className="btn">New case</Link>
      </div>
      {cases.length === 0 ? (
        <div className="card text-center">
          <p className="muted">No cases yet. Every case starts with the person it is about.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cases.map((c) => {
            const v = c.victims[0];
            return (
              <li key={c.id}>
                <Link href={`/cases/${c.id}`} className="card block hover:border-accent">
                  <p className="text-lg font-semibold">{v?.name ?? "Unnamed"}</p>
                  {v && (
                    <p className="muted">
                      {[v.bornOn && formatDate(v.bornOn, "YEAR"), v.diedOn && formatDate(v.diedOn, "YEAR")]
                        .filter(Boolean)
                        .join(" to ")}
                      {v.hometown ? ` · ${v.hometown}` : ""}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-stone-600">{c.title}</p>
                  <p className="muted mt-3">
                    {c._count.sources} sources · {c._count.timelineEvents} events · {c._count.episodes} episodes
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
