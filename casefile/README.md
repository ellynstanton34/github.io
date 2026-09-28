# Casefile

A research and fact-check workspace for true crime podcasters and YouTubers. This is the creator side. The audience side comes later.

## What's in v1

- Cases open with the victim: a profile, where it came from (family, primary sources, other), a photo placeholder, and family notes.
- Sources added by link, file upload or pasted text, each rated Primary, Reliable or Weak.
- A timeline of dated events linked to sources, labeled "Court doc", "2 sources", "Unverified" and so on.
- A sourcing score per episode, 0 to 100, plus a count of claims with no source.
- The pre-publish check: paste a script. Claude finds the claims and matches them to your sources. The app flags weak sources stated as fact, non-convicted people described as guilty, and anything the family asked to leave out. Each flag has a reason and a suggested rewrite.
- Draft scripts from the timeline and sources. It opens with the victim and cites a source after each claim.

## Run it locally

You need Node 20.9+ and Postgres.

```bash
cp .env.example .env        # then fill in the values
npm install
npm run db:migrate          # creates the tables
npm run db:seed             # loads the made-up sample case
npm run dev
```

Open http://localhost:3000 and sign in as `demo@casefile.test`. No email is sent yet: in development the sign-in link appears on screen.

The sample case (June Harlow) is fictional. Its Episode 1 script has deliberate problems, so the check has something to catch.

## Where things live

| What | File |
| --- | --- |
| Data model | `prisma/schema.prisma` |
| All AI prompts and calls | `src/lib/ai.ts` |
| Flag rules (what counts as a problem) | `src/lib/flag-rules.ts` |
| Score formula and timeline labels | `src/lib/scoring.ts` |
| Sample data | `prisma/seed.ts` |
| Screens | `src/app/cases/...` |

Score: each claim earns 100 for a Primary source or 2+ Reliable, 60 for one Reliable, 20 for Weak only, 0 for none. Rumors are capped at 20. The episode score is the average.

## Checks

```bash
npm test          # score and flag rules
npm run typecheck
npm run lint
```

## Before going live

- Hook up an email service for sign-in links (see `src/lib/auth.ts`).
- Move file uploads from local disk to cloud storage (see `addSource` in `src/app/cases/actions.ts`). PDFs are stored but not read by the check yet, so paste key passages when you add one.
- Host on something that runs Node and Postgres (e.g. Vercel plus a hosted Postgres). GitHub Pages can't run this app.
