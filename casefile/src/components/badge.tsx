const tones = {
  strong: "bg-accent text-white",
  ok: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-stone-100 text-stone-600",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
  );
}

export const ratingTone = { PRIMARY: "strong", RELIABLE: "ok", WEAK: "warn" } as const;
export const claimTone = { CONFIRMED: "strong", ALLEGED: "ok", RUMOR: "warn" } as const;
