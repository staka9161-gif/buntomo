import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ exists: false, count: 0 });
  }
  const session = await auth();
  const myId = session?.user?.id;
  const count = await prisma.user.count({
    where: {
      name: name.trim(),
      ...(myId ? { NOT: { id: myId } } : {}),
    },
  });
  return NextResponse.json({ exists: count > 0, count });
}
