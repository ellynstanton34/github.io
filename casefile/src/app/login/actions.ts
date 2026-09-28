"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createLoginLink, endSession } from "@/lib/auth";

export type LoginState = { sent?: boolean; devLink?: string; error?: string };

export async function requestLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = await createLoginLink(email, base);
  // No email service yet. Outside production, show the link so you can sign in.
  return { sent: true, devLink: process.env.NODE_ENV === "production" ? undefined : link };
}

export async function logout() {
  await endSession();
  redirect("/login");
}
