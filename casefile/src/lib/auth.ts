import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// Email login: you enter an email, get a one-time link, and the link sets a signed session cookie.
// No email service is wired up yet, so in development the link is shown on screen and logged.

const SESSION_COOKIE = "cf_session";
const SESSION_DAYS = 30;
const LINK_MINUTES = 20;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createLoginLink(email: string, baseUrl: string) {
  const normalized = email.trim().toLowerCase();
  const user = await db.user.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
  });
  const token = randomBytes(32).toString("base64url");
  await db.loginToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000),
    },
  });
  const link = `${baseUrl}/auth/verify?token=${token}`;
  console.log(`[login] link for ${normalized}: ${link}`);
  return link;
}

// Returns the user id if the token is valid and unused, and marks it used.
export async function consumeLoginToken(token: string) {
  const row = await db.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  await db.loginToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export async function startSession(userId: string) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [userId, expires, sig] = raw.split(".");
  if (!userId || !expires || !sig) return null;
  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) < Date.now()) return null;
  return db.user.findUnique({ where: { id: userId } });
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

// Loads a case only if the signed-in user owns it.
export async function requireCase(caseId: string) {
  const user = await requireUser();
  const found = await db.case.findFirst({ where: { id: caseId, ownerId: user.id } });
  if (!found) redirect("/");
  return { user, case: found };
}
