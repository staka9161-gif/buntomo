import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminUsers } from "@/lib/admin-users";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { searchParams } = new URL(request.url);
  const users = await getAdminUsers({
    query: searchParams.get("query"),
    status: searchParams.get("status"),
    hasReports: searchParams.get("hasReports"),
    hasOpenReports: searchParams.get("hasOpenReports"),
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  });

  return NextResponse.json(users);
}
