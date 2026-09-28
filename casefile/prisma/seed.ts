// Sample data: a made-up case. Every person, place and source below is fictional.
// Run with: npm run db:seed  (sign in as demo@casefile.test to see it)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { DatePrecision } from "../src/generated/prisma/enums";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function main() {
  const email = "demo@casefile.test";
  await db.user.deleteMany({ where: { email } });
  const user = await db.user.create({ data: { email, name: "Demo creator" } });

  const c = await db.case.create({
    data: {
      title: "The disappearance of June Harlow (fictional sample case)",
      summary:
        "June Harlow, 27, a library assistant in the fictional town of Cedar Hollow, went missing after a late shift in October 2019. A coworker was later charged. This case is made up for testing.",
      ownerId: user.id,
      victims: {
        create: {
          name: "June Harlow",
          bornOn: d("1992-04-11"),
          diedOn: d("2019-10-18"),
          hometown: "Cedar Hollow",
          profileBasis: "FAMILY",
          photoCredit: "Courtesy of the Harlow family (placeholder)",
          profile:
            "June was the one who remembered everyone's birthday. She ran the Saturday story hour at the Cedar Hollow Public Library for five years and kept a list of every kid who got their first library card there.\n\nShe was saving for a trip to Ireland with her mother, Ellen, and was halfway through a night-school degree in library science. Her friends say she laughed at her own jokes before she got to the punchline. She had a three-legged cat named Biscuit.",
        },
      },
      familyNotes: {
        create: [
          {
            kind: "DO_NOT_INCLUDE",
            text: "Do not describe the condition of June's remains.",
            fromWhom: "Ellen Harlow (mother)",
            receivedOn: d("2024-02-03"),
          },
          {
            kind: "DO_NOT_INCLUDE",
            text: "Do not mention June's past treatment for depression. It has nothing to do with what happened.",
            fromWhom: "Ellen Harlow (mother)",
            receivedOn: d("2024-02-03"),
          },
          {
            kind: "PREFERENCE",
            text: "Please call her June, never her full name Juniper.",
            fromWhom: "Ellen Harlow (mother)",
          },
          {
            kind: "CONTEXT",
            text: "The family is open to a follow-up interview through their attorney, Dana Ruiz.",
          },
        ],
      },
    },
  });

  const [travis, owen] = await Promise.all([
    db.person.create({
      data: {
        caseId: c.id,
        name: "Travis Kell",
        role: "OTHER",
        legalStatus: "UNCHARGED",
        notes: "June's ex-boyfriend. Heavily discussed online. Police say he is not a suspect.",
      },
    }),
    db.person.create({
      data: {
        caseId: c.id,
        name: "Owen Pratt",
        role: "SUSPECT",
        legalStatus: "CHARGED",
        notes: "Library coworker. Charged with second-degree murder in 2021. Trial pending.",
      },
    }),
    db.person.create({
      data: { caseId: c.id, name: "Det. Rosa Imari", role: "INVESTIGATOR", legalStatus: "UNCHARGED" },
    }),
    db.person.create({
      data: { caseId: c.id, name: "Ellen Harlow", role: "FAMILY", legalStatus: "UNCHARGED", notes: "June's mother." },
    }),
  ]);

  const source = (data: Omit<Prisma.SourceUncheckedCreateInput, "caseId">) =>
    db.source.create({ data: { ...data, caseId: c.id } });

  // Created one at a time so the S1..S6 refs stay in this order.
  const s1 = await source({
    title: "Statement from Ellen Harlow",
    type: "TEXT",
    rating: "PRIMARY",
    kind: "FAMILY_STATEMENT",
    publishedOn: d("2024-02-03"),
    text: "June left the library at about 9:15 on Friday night, October 18. She texted me at 9:22 that she was stopping for gas and would call when she got home. She never called. Her car was found two days later on Route 9 near the quarry turnoff. June loved that library. She was going to finish her degree in the spring.",
  });
  const s2 = await source({
    title: "Criminal complaint, State v. Owen Pratt",
    type: "TEXT",
    rating: "PRIMARY",
    kind: "COURT_DOC",
    publishedOn: d("2021-06-14"),
    text: "The defendant, Owen Pratt, is charged with murder in the second degree in the death of June Harlow. Surveillance footage from the Route 9 Gas-N-Go shows the defendant's vehicle at pump 4 at 9:31 p.m. on October 18, 2019, eight minutes after June Harlow's vehicle. Cell tower records place the defendant's phone near the quarry turnoff between 10:05 and 10:40 p.m.",
  });
  const s3 = await source({
    title: "Cedar Hollow Sheriff's Office press release",
    type: "TEXT",
    rating: "PRIMARY",
    kind: "POLICE_RECORD",
    publishedOn: d("2019-10-21"),
    text: "The Sheriff's Office is asking for the public's help locating June Harlow, 27, last seen October 18 at approximately 9:15 p.m. Her 2011 blue Honda Civic was located October 20 on Route 9. Travis Kell, who has been named on social media, was interviewed and is not considered a suspect.",
  });
  const s4 = await source({
    title: "Cedar Hollow Gazette: Coworker charged in Harlow case",
    type: "URL",
    url: "https://example.com/gazette/harlow-charge",
    rating: "RELIABLE",
    kind: "NEWS",
    publishedOn: d("2021-06-15"),
    text: "Owen Pratt, 34, who worked with June Harlow at the Cedar Hollow Public Library, was arrested Monday and charged with second-degree murder. Pratt has pleaded not guilty. His attorney called the evidence circumstantial. Remains found in March 2021 near the old quarry were identified as Harlow's.",
  });
  const s5 = await source({
    title: "Reddit thread: 'I saw June and Travis arguing'",
    type: "URL",
    url: "https://example.com/r/unsolved/june-harlow",
    rating: "WEAK",
    kind: "SOCIAL_MEDIA",
    publishedOn: d("2019-10-25"),
    text: "Anonymous user: I'm pretty sure I saw June arguing with her ex Travis at the Gas-N-Go that night. He was yelling. Everyone in town knows he had a temper.",
  });
  const s6 = await source({
    title: "KCHV interview with neighbor Marcus Webb",
    type: "URL",
    url: "https://example.com/kchv/webb-interview",
    rating: "RELIABLE",
    kind: "INTERVIEW",
    publishedOn: d("2019-10-24"),
    text: "Marcus Webb, who lives across from the Harlow home, said June usually got home by 9:45 on Fridays. 'Her porch light stayed on all weekend. That's when I knew something was wrong.'",
  });

  const event = (date: string, title: string, description: string, sourceIds: string[], precision: DatePrecision = "DAY") =>
    db.timelineEvent.create({
      data: {
        caseId: c.id,
        date: d(date),
        datePrecision: precision,
        title,
        description,
        sources: { create: sourceIds.map((sourceId) => ({ sourceId })) },
      },
    });

  await event("2019-10-18", "June leaves the library", "Around 9:15 p.m., after her Friday shift.", [s1.id, s3.id]);
  await event("2019-10-18", "Last text to her mother", "At 9:22 p.m. she says she is stopping for gas.", [s1.id]);
  await event("2019-10-18", "Seen arguing at the gas station", "An anonymous Reddit user claims June argued with her ex, Travis Kell.", [s5.id]);
  await event("2019-10-18", "Pratt's car at the Gas-N-Go", "Surveillance shows Owen Pratt's vehicle at 9:31 p.m.", [s2.id]);
  await event("2019-10-20", "June's car found on Route 9", "Near the quarry turnoff.", [s1.id, s3.id]);
  await event("2019-10-21", "Sheriff asks public for help", "Says Travis Kell was interviewed and is not a suspect.", [s3.id]);
  await event("2021-03-01", "Remains found near the old quarry", "Later identified as June's.", [s4.id], "MONTH");
  await event("2021-06-14", "Owen Pratt charged", "Second-degree murder. He pleads not guilty.", [s2.id, s4.id]);
  await event("2023-01-01", "Candlelight vigil at the library", "Friends mark what would have been story hour.", [], "APPROXIMATE");

  // A deliberately flawed script, so the pre-publish check has something to catch.
  const episode = await db.episode.create({
    data: {
      caseId: c.id,
      title: "Episode 1: The last shift",
      script: `June Harlow ran the Saturday story hour at the Cedar Hollow library for five years. She had a three-legged cat named Biscuit, and she was saving for a trip to Ireland with her mom. [S1]

On Friday, October 18, 2019, June left the library around 9:15 and texted her mother that she was stopping for gas. [S1]

That night at the Gas-N-Go, June got into a screaming match with her ex-boyfriend, Travis Kell. Everyone in town knows Travis had a temper, and honestly, a lot of people still think he did it.

Eight minutes after June's car pulled into the station, Owen Pratt's car pulled in behind her. [S2] Pratt followed her out to the quarry and killed her.

People who knew June say she had struggled with depression in college, which is why police first thought she might have left on her own.

June's car was found two days later on Route 9. When her remains were finally found in 2021, they were badly decomposed.

June's neighbor says her porch light stayed on all weekend. [S6]`,
    },
  });

  // Claims as a checker would record them, so the score shows before you run the AI check.
  const claim = (text: string, status: "CONFIRMED" | "ALLEGED" | "RUMOR", sourceIds: string[], people: string[] = []) =>
    db.claim.create({
      data: {
        caseId: c.id,
        episodeId: episode.id,
        text,
        status,
        sources: { create: sourceIds.map((sourceId) => ({ sourceId })) },
        people: { connect: people.map((id) => ({ id })) },
      },
    });
  await claim("June ran the Saturday story hour for five years.", "CONFIRMED", [s1.id]);
  await claim("June left the library around 9:15 p.m. and texted she was stopping for gas.", "CONFIRMED", [s1.id, s3.id]);
  await claim("June argued with Travis Kell at the gas station that night.", "RUMOR", [s5.id], [travis.id]);
  await claim("Owen Pratt's car arrived at the station eight minutes after June's.", "CONFIRMED", [s2.id], [owen.id]);
  await claim("Owen Pratt followed June to the quarry and killed her.", "ALLEGED", [s2.id], [owen.id]);
  await claim("June's car was found two days later on Route 9.", "CONFIRMED", [s1.id, s3.id]);
  await claim("Police first thought June might have left on her own.", "RUMOR", []);
  await claim("June's porch light stayed on all weekend.", "CONFIRMED", [s6.id]);

  const { episodeScore } = await import("../src/lib/scoring");
  const claims = await db.claim.findMany({
    where: { episodeId: episode.id },
    include: { sources: { include: { source: true } } },
  });
  const score = episodeScore(claims.map((cl) => ({ status: cl.status, sources: cl.sources.map((cs) => cs.source) })));
  await db.episode.update({
    where: { id: episode.id },
    data: { sourcingScore: score.score, unsourcedCount: score.unsourced },
  });

  console.log(`Seeded "${c.title}". Sign in as ${email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
