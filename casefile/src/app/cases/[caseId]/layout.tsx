import { db } from "@/lib/db";
import { requireCase } from "@/lib/auth";
import { CaseTabs } from "@/components/case-tabs";

export default async function CaseLayout({ children, params }: LayoutProps<"/cases/[caseId]">) {
  const { caseId } = await params;
  const { case: c } = await requireCase(caseId);
  const victim = await db.victim.findFirst({ where: { caseId, isPrimary: true } });
  return (
    <div>
      <p className="muted">{c.title}</p>
      <h1 className="mb-4 text-2xl font-semibold">{victim?.name ?? "Unnamed victim"}</h1>
      <CaseTabs caseId={caseId} />
      {children}
    </div>
  );
}
