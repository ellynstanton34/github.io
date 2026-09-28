import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Every Claude call in the app lives in this file, so the prompts are easy to find and change.
// Callers pass plain data in (see CaseContext) and get plain data back. No database access here.

const MODEL = "claude-opus-5-5";

// If Claude declines a request, the API retries it on a fallback model it picks.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export class AiError extends Error {}

function client() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AiError("AI is not set up yet. Add ANTHROPIC_API_KEY to the .env file and restart the app.");
  }
  return new Anthropic();
}

function explain(err: unknown): never {
  if (err instanceof AiError) throw err;
  if (err instanceof Anthropic.AuthenticationError) throw new AiError("The Anthropic API key was rejected.");
  if (err instanceof Anthropic.RateLimitError) throw new AiError("Rate limited by the AI service. Try again in a minute.");
  if (err instanceof Anthropic.APIError) throw new AiError(`AI service error (${err.status}): ${err.message}`);
  throw err;
}

// ---------- Shared case context ----------

export type CaseContext = {
  title: string;
  victims: { name: string; profile: string; basis: string; born?: string; died?: string; hometown?: string }[];
  familyNotes: { id: string; kind: string; text: string; fromWhom?: string }[];
  people: { id: string; name: string; role: string; legalStatus: string; notes?: string }[];
  sources: { ref: string; title: string; rating: string; kind: string; url?: string; text?: string; notes?: string }[];
  events: { date: string; title: string; description?: string; sourceRefs: string[]; label: string }[];
};

// Escapes a value for use inside an XML-style attribute in the prompt.
function a(value: string | number | undefined) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderContext(ctx: CaseContext) {
  const victims = ctx.victims
    .map(
      (v) =>
        `<victim name="${a(v.name)}" born="${a(v.born ?? "")}" died="${a(v.died ?? "")}" hometown="${a(v.hometown ?? "")}" profile_basis="${a(v.basis)}">\n${v.profile}\n</victim>`,
    )
    .join("\n");
  const notes = ctx.familyNotes
    .map((n) => `<family_note id="${a(n.id)}" kind="${a(n.kind)}" from="${a(n.fromWhom ?? "")}">${n.text}</family_note>`)
    .join("\n");
  const people = ctx.people
    .map(
      (p) =>
        `<person id="${a(p.id)}" name="${a(p.name)}" role="${a(p.role)}" legal_status="${a(p.legalStatus)}">${p.notes ?? ""}</person>`,
    )
    .join("\n");
  const sources = ctx.sources
    .map(
      (s) =>
        `<source ref="${a(s.ref)}" title="${a(s.title)}" rating="${a(s.rating)}" kind="${a(s.kind)}" url="${a(s.url ?? "")}">\n${s.notes ? `Notes: ${s.notes}\n` : ""}${s.text ?? "(no text on file; judge from the title and notes only)"}\n</source>`,
    )
    .join("\n");
  const events = ctx.events
    .map(
      (e) =>
        `<event date="${a(e.date)}" sources="${a(e.sourceRefs.join(","))}" label="${a(e.label)}">${e.title}${e.description ? `: ${e.description}` : ""}</event>`,
    )
    .join("\n");
  return `<case title="${a(ctx.title)}">
<victims>
${victims}
</victims>
<family_notes>
${notes || "(none)"}
</family_notes>
<people>
${people || "(none)"}
</people>
<sources>
${sources || "(none)"}
</sources>
<timeline>
${events || "(none)"}
</timeline>
</case>`;
}

const RATINGS = `Source ratings: PRIMARY means court records, police records, official documents, or first-hand family statements. RELIABLE means established news outlets and on-record interviews. WEAK means forums, social media, anonymous tips, or anything unverified.`;

const LEGAL = `Legal status of people: only a CONVICTED person may be described as having committed the crime. A CHARGED person is "accused" or "charged with". UNCHARGED, ACQUITTED and CLEARED people must never be described or implied to be guilty, including through insinuation ("everyone knew it was him", "he never explained where he was").`;

// ---------- Pre-publish check ----------

const CheckResult = z.object({
  claims: z.array(
    z.object({
      excerpt: z.string().describe("The sentence(s) from the script that make the claim, copied exactly."),
      claim: z.string().describe("The factual claim in one short neutral sentence."),
      statedAsFact: z.boolean().describe("True if the script presents it as settled fact, with no hedging or attribution."),
      sourceRefs: z.array(z.string()).describe("Refs (like S3) of sources whose content actually supports the claim."),
      suggestedStatus: z.enum(["CONFIRMED", "ALLEGED", "RUMOR"]),
      people: z.array(
        z.object({
          personId: z.string(),
          describedAsGuilty: z.boolean(),
        }),
      ),
      saferRewrite: z
        .string()
        .nullable()
        .describe("A rewrite of the excerpt that matches the sourcing and legal status. Null if the excerpt is fine."),
    }),
  ),
  familyConflicts: z.array(
    z.object({
      familyNoteId: z.string(),
      excerpt: z.string(),
      reason: z.string().describe("One sentence on how the excerpt goes against the note."),
      suggestedRewrite: z.string().describe("The excerpt rewritten to respect the note, or an empty string to cut it."),
    }),
  ),
  unlistedPeopleDescribedAsGuilty: z.array(
    z.object({
      name: z.string(),
      excerpt: z.string(),
      suggestedRewrite: z.string(),
    }),
  ),
});

export type CheckResult = z.infer<typeof CheckResult>;

const CHECK_SYSTEM = `You fact-check true crime podcast and video scripts before they are published. You protect three groups: the victim and their family, people who have not been convicted, and the audience, who deserve to know what is proven and what is not.

${RATINGS}

${LEGAL}

Your job:
1. Break the script into factual claims about the case. Skip the host's opinions, transitions and sign-offs. A claim is anything a listener would take as a fact about people or events.
2. For each claim, find the sources in the case file whose content supports it. Match on content. Citations already in the script like [S3] are hints, not proof: include a ref only if that source actually supports the claim. If nothing supports it, return an empty list.
3. Decide if the script states the claim as settled fact. Attribution or hedging ("police allege", "according to a Reddit post", "unconfirmed reports say") means it is not stated as fact.
4. Suggest a status: CONFIRMED if Primary or Reliable sources establish it, ALLEGED if it is an accusation or charge not yet proven, RUMOR if only weak sources or none support it.
5. For every person in the people list who is mentioned in a claim, say whether the claim describes or implies them as guilty.
6. Write saferRewrite whenever the claim is stated as fact but its sources are all WEAK or missing, or it describes a non-convicted person as guilty. Keep the host's voice and keep it short. Otherwise null.
7. Check every family note of kind DO_NOT_INCLUDE against the whole script, including indirect references and paraphrase. Report each conflict.
8. If the script describes someone who is not in the people list as guilty of the crime, report them in unlistedPeopleDescribedAsGuilty.

Copy excerpts exactly from the script so they can be found and highlighted.`;

export async function runPrePublishCheck(ctx: CaseContext, script: string): Promise<CheckResult> {
  try {
    const stream = client().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      ...FALLBACK,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(CheckResult) },
      system: CHECK_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${renderContext(ctx)}\n\n<script>\n${script}\n</script>\n\nCheck this script against the case file.`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AiError("The AI declined to check this script. Try again or check it by hand.");
    if (message.stop_reason === "max_tokens") throw new AiError("The script was too long to check in one pass. Try checking it in parts.");
    if (!message.parsed_output) throw new AiError("The AI returned an answer in an unexpected shape. Try again.");
    return message.parsed_output;
  } catch (err) {
    explain(err);
  }
}

// ---------- Draft script ----------

const DRAFT_SYSTEM = `You draft true crime podcast scripts from a researcher's case file. The script is a first draft for a human host to edit.

${RATINGS}

${LEGAL}

Rules:
- Open with the victim as a person: who they were, what they loved, what the people close to them remember. Use the victim profile and family statements. Do not open with the crime, the body, or the suspect.
- After every factual claim, cite the source refs in square brackets, like [S2] or [S2, S5]. Only cite sources that actually support the claim.
- Use only facts found in the case file. Do not invent details, quotes, dialogue, or scenes.
- Match confidence to sourcing. Claims backed only by WEAK sources must be framed as unverified ("an unverified post claimed..."), or left out. Timeline events labeled Unverified get the same treatment.
- Follow every family note. Leave out anything a DO_NOT_INCLUDE note covers, even indirectly. Honor PREFERENCE notes (names, pronouns, tone).
- No graphic detail about injuries or the body beyond what is needed to understand the case.
- Plain spoken English, short paragraphs, written for the ear. No headings or markdown. Mark natural breaks with a blank line.
- End with where the case stands now, and remember the victim once more.`;

export async function draftScript(ctx: CaseContext, episodeTitle: string): Promise<string> {
  try {
    const stream = client().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      ...FALLBACK,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: DRAFT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${renderContext(ctx)}\n\nWrite a first draft of the episode "${episodeTitle}". Aim for 1,200 to 1,800 words.`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new AiError("The AI declined to draft this episode.");
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new AiError("The AI returned an empty draft. Try again.");
    return text;
  } catch (err) {
    explain(err);
  }
}
