import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseVisibility } from "@/lib/visibility";

const PROFILE_SELECT = {
  email: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  linkX: true,
  linkInstagram: true,
  linkWebsite: true,
  area: true,
  customLinks: true,
  visibility: true,
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: PROFILE_SELECT,
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  let customLinks: unknown[] = [];
  if (user.customLinks) {
    try { customLinks = JSON.parse(user.customLinks); } catch { /* corrupted data */ }
  }

  return NextResponse.json({
    profile: {
      ...user,
      customLinks,
      visibility: parseVisibility(user.visibility),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    const name = body.displayName?.trim();
    if (!name) {
      return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
    }
    if (name.length > 20) {
      return NextResponse.json({ error: "名前は20文字以内にしてください" }, { status: 400 });
    }
    updateData.displayName = name;
  }

  if (body.bio !== undefined) {
    if (body.bio && body.bio.trim().length > 40) {
      return NextResponse.json({ error: "一言は40文字以内にしてください" }, { status: 400 });
    }
    updateData.bio = body.bio?.trim() || null;
  }

  if (body.linkX !== undefined) {
    updateData.linkX = body.linkX?.trim() || null;
  }
  if (body.linkInstagram !== undefined) {
    updateData.linkInstagram = body.linkInstagram?.trim() || null;
  }
  if (body.linkWebsite !== undefined) {
    updateData.linkWebsite = body.linkWebsite?.trim() || null;
  }

  if (body.area !== undefined) {
    if (body.area && body.area.trim().length > 15) {
      return NextResponse.json({ error: "エリアは15文字以内にしてください" }, { status: 400 });
    }
    updateData.area = body.area?.trim() || null;
  }

  if (body.visibility !== undefined) {
    updateData.visibility = JSON.stringify(body.visibility);
  }

  if (body.customLinks !== undefined) {
    if (!Array.isArray(body.customLinks) || body.customLinks.length > 3) {
      return NextResponse.json({ error: "追加リンクは3つまでです" }, { status: 400 });
    }
    for (const link of body.customLinks) {
      if (!link.label?.trim() || !link.url?.trim()) {
        return NextResponse.json({ error: "リンクにはラベルとURLが必要です" }, { status: 400 });
      }
    }
    updateData.customLinks = JSON.stringify(
      body.customLinks.map((l: { label: string; url: string }) => ({
        label: l.label.trim(),
        url: l.url.trim(),
      }))
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: PROFILE_SELECT,
    });

    let customLinks: unknown[] = [];
    if (user.customLinks) {
      try { customLinks = JSON.parse(user.customLinks); } catch { /* corrupted data */ }
    }

    return NextResponse.json({
      profile: {
        ...user,
        customLinks,
        visibility: parseVisibility(user.visibility),
      },
    });
  } catch {
    return NextResponse.json({ error: "プロフィールの更新に失敗しました" }, { status: 500 });
  }
}
