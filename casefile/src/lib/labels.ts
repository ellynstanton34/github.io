// Human-readable names for the database enums.

export const ratingLabel = { PRIMARY: "Primary", RELIABLE: "Reliable", WEAK: "Weak" } as const;

export const kindLabel = {
  COURT_DOC: "Court doc",
  POLICE_RECORD: "Police record",
  NEWS: "News",
  INTERVIEW: "Interview",
  FAMILY_STATEMENT: "Family statement",
  SOCIAL_MEDIA: "Social media",
  OTHER: "Other",
} as const;

export const claimStatusLabel = { CONFIRMED: "Confirmed", ALLEGED: "Alleged", RUMOR: "Rumor" } as const;

export const basisLabel = {
  FAMILY: "Written with the family",
  PRIMARY_SOURCE: "From primary sources",
  OTHER: "Other sources",
} as const;

export const familyNoteLabel = {
  DO_NOT_INCLUDE: "Do not include",
  PREFERENCE: "Preference",
  CONTEXT: "Context",
} as const;

export const roleLabel = {
  SUSPECT: "Suspect",
  WITNESS: "Witness",
  INVESTIGATOR: "Investigator",
  FAMILY: "Family",
  OTHER: "Other",
} as const;

export const legalLabel = {
  UNCHARGED: "Uncharged",
  CHARGED: "Charged",
  CONVICTED: "Convicted",
  ACQUITTED: "Acquitted",
  CLEARED: "Cleared",
} as const;

export const precisionLabel = {
  DAY: "Exact day",
  MONTH: "Month",
  YEAR: "Year",
  APPROXIMATE: "Approximate",
} as const;

export const flagKindLabel = {
  WEAK_SOURCE_AS_FACT: "Weak source stated as fact",
  UNCHARGED_NAMED_GUILTY: "Person described as guilty",
  FAMILY_REQUEST: "Family asked to leave out",
  NO_SOURCE: "No source",
} as const;

export function formatDate(d: Date | null | undefined, precision: keyof typeof precisionLabel = "DAY") {
  if (!d) return "";
  const opts: Intl.DateTimeFormatOptions =
    precision === "YEAR"
      ? { year: "numeric", timeZone: "UTC" }
      : precision === "MONTH"
        ? { year: "numeric", month: "long", timeZone: "UTC" }
        : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" };
  const text = d.toLocaleDateString("en-US", opts);
  return precision === "APPROXIMATE" ? `c. ${text}` : text;
}

// Source refs used in scripts and AI prompts: S1, S2, ... in creation order.
export function sourceRef(index: number) {
  return `S${index + 1}`;
}
