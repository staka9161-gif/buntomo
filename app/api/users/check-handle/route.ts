import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeHandle, isValidHandle } from "@/lib/handle";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("handle") ?? "";
  if (!raw.trim()) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const handle = normalizeHandle(raw);
  if (!isValidHandle(handle)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const session = await auth();
  const myId = session?.user?.id;

  const existing = await prisma.user.findUnique({ where: { handle } });
  if (existing && existing.id !== myId) {
    return NextResponse.json({ available: false, reason: "taken" });
  }

  return NextResponse.json({ available: true });
}
