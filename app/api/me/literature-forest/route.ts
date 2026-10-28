import { auth } from "@/lib/auth";
import { listForest } from "@/lib/literature-forest/server";
import { forestFailure, forestJson } from "@/lib/literature-forest/http";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return forestJson({ error: "ログインが必要です" }, 401);
  try {
    return forestJson({ trees: await listForest(session.user.id) });
  } catch (error) {
    return forestFailure(error);
  }
}
