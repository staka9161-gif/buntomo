import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeText, removeSymbols } from "@/lib/normalize";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { query, clickedIsbn, rankShown, action } = body;

    if (!query || !action) {
      return NextResponse.json({ error: "query and action are required" }, { status: 400 });
    }

    const validActions = ["clicked", "registered", "read"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const normalizedQuery = removeSymbols(normalizeText(query)).toLowerCase();

    await prisma.learningSignal.create({
      data: {
        queryNormalized: normalizedQuery,
        isbn: clickedIsbn || null,
        bookId: null,
        rankShown: typeof rankShown === "number" ? rankShown : 0,
        action,
        userId: session?.user?.id || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Feedback error:", e);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
