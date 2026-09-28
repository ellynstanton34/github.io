export function scoreTone(score: number | null) {
  if (score === null) return "text-stone-400";
  if (score >= 80) return "text-accent";
  if (score >= 50) return "text-stone-700";
  return "text-warn";
}

export function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className={`min-w-12 text-right text-lg font-semibold tabular-nums ${scoreTone(score)}`}>
      {score ?? "--"}
      <span className="text-xs font-normal text-stone-400">/100</span>
    </span>
  );
}
