import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlags } from "@/lib/flag-rules";
import { claimPoints, episodeScore, timelineLabel } from "@/lib/scoring";
import type { CheckResult } from "@/lib/ai";
import type { Source } from "@/generated/prisma/client";

const src = (id: string, rating: Source["rating"], kind: Source["kind"] = "NEWS") =>
  ({ id, title: `Source ${id}`, rating, kind }) as Source;

const sources = new Map([
  ["S1", src("a", "PRIMARY", "FAMILY_STATEMENT")],
  ["S2", src("b", "PRIMARY", "COURT_DOC")],
  ["S5", src("e", "WEAK", "SOCIAL_MEDIA")],
]);
const people = [
  { id: "travis", name: "Travis Kell", legalStatus: "UNCHARGED" as const },
  { id: "owen", name: "Owen Pratt", legalStatus: "CHARGED" as const },
  { id: "zed", name: "Zed Convict", legalStatus: "CONVICTED" as const },
];
const notes = [{ id: "n1", text: "Do not mention depression." }];

const claim = (over: Partial<CheckResult["claims"][number]>): CheckResult["claims"][number] => ({
  excerpt: "x",
  claim: "x",
  statedAsFact: true,
  sourceRefs: [],
  suggestedStatus: "CONFIRMED",
  people: [],
  saferRewrite: null,
  ...over,
});

test("scoring follows the approved formula", () => {
  assert.equal(claimPoints("CONFIRMED", [src("a", "PRIMARY")]), 100);
  assert.equal(claimPoints("CONFIRMED", [src("a", "RELIABLE"), src("b", "RELIABLE")]), 100);
  assert.equal(claimPoints("CONFIRMED", [src("a", "RELIABLE")]), 60);
  assert.equal(claimPoints("CONFIRMED", [src("a", "WEAK")]), 20);
  assert.equal(claimPoints("CONFIRMED", []), 0);
  assert.equal(claimPoints("RUMOR", [src("a", "PRIMARY")]), 20);
  const s = episodeScore([
    { status: "CONFIRMED", sources: [src("a", "PRIMARY")] },
    { status: "CONFIRMED", sources: [] },
  ]);
  assert.deepEqual(s, { score: 50, unsourced: 1, total: 2 });
});

test("timeline labels", () => {
  assert.equal(timelineLabel([]).text, "Unverified");
  assert.equal(timelineLabel([src("a", "PRIMARY", "COURT_DOC"), src("b", "RELIABLE")]).text, "Court doc");
  assert.equal(timelineLabel([src("a", "RELIABLE"), src("b", "RELIABLE")]).text, "2 sources");
  assert.equal(timelineLabel([src("a", "WEAK")]).tone, "warn");
});

test("weak-only claim stated as fact is flagged, hedged one is not", () => {
  const { flags } = buildFlags(
    {
      claims: [
        claim({ excerpt: "fact", sourceRefs: ["S5"], saferRewrite: "An unverified post claimed..." }),
        claim({ excerpt: "hedged", sourceRefs: ["S5"], statedAsFact: false }),
        claim({ excerpt: "strong", sourceRefs: ["S5", "S1"] }),
      ],
      familyConflicts: [],
      unlistedPeopleDescribedAsGuilty: [],
    },
    people,
    notes,
    sources,
  );
  assert.deepEqual(flags.map((f) => [f.kind, f.excerpt]), [["WEAK_SOURCE_AS_FACT", "fact"]]);
  assert.equal(flags[0].suggestedRewrite, "An unverified post claimed...");
});

test("unsourced claims and unknown refs flag NO_SOURCE", () => {
  const { flags } = buildFlags(
    {
      claims: [claim({ excerpt: "none" }), claim({ excerpt: "bogus", sourceRefs: ["S99"] })],
      familyConflicts: [],
      unlistedPeopleDescribedAsGuilty: [],
    },
    people,
    notes,
    sources,
  );
  assert.deepEqual(flags.map((f) => f.kind), ["NO_SOURCE", "NO_SOURCE"]);
});

test("guilt check: uncharged and charged flagged, convicted not, unknown ids ignored", () => {
  const { flags } = buildFlags(
    {
      claims: [
        claim({
          excerpt: "they did it",
          sourceRefs: ["S2"],
          people: [
            { personId: "travis", describedAsGuilty: true },
            { personId: "owen", describedAsGuilty: true },
            { personId: "zed", describedAsGuilty: true },
            { personId: "ghost", describedAsGuilty: true },
          ],
        }),
      ],
      familyConflicts: [],
      unlistedPeopleDescribedAsGuilty: [{ name: "Some Neighbor", excerpt: "the neighbor did it", suggestedRewrite: "" }],
    },
    people,
    notes,
    sources,
  );
  assert.deepEqual(
    flags.map((f) => [f.kind, f.personId ?? null]),
    [
      ["UNCHARGED_NAMED_GUILTY", "travis"],
      ["UNCHARGED_NAMED_GUILTY", "owen"],
      ["UNCHARGED_NAMED_GUILTY", null],
    ],
  );
  assert.match(flags[1].reason, /charged, not convicted/);
});

test("family conflicts need a real note id; empty rewrite (cut) is kept", () => {
  const { flags } = buildFlags(
    {
      claims: [],
      familyConflicts: [
        { familyNoteId: "n1", excerpt: "she struggled", reason: "Mentions it.", suggestedRewrite: "" },
        { familyNoteId: "made-up", excerpt: "y", reason: "z", suggestedRewrite: "w" },
      ],
      unlistedPeopleDescribedAsGuilty: [],
    },
    people,
    notes,
    sources,
  );
  assert.equal(flags.length, 1);
  assert.equal(flags[0].kind, "FAMILY_REQUEST");
  assert.equal(flags[0].suggestedRewrite, "");
  assert.match(flags[0].reason, /Do not mention depression/);
});
