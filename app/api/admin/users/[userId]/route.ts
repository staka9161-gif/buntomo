import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminUserDetail } from "@/lib/admin-users";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { userId } = await params;
  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    return NextResponse.json({ error: "利用者が見つかりません" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
