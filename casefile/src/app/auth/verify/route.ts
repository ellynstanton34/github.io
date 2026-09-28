import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginToken, startSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const userId = token ? await consumeLoginToken(token) : null;
  if (!userId) return NextResponse.redirect(new URL("/login?expired=1", request.url));
  await startSession(userId);
  return NextResponse.redirect(new URL("/", request.url));
}
