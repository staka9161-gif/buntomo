import { auth } from "@/lib/auth";
import { requireActiveUser } from "@/lib/active-user";
import {
  getForestEntry,
  saveClassification,
} from "@/lib/literature-forest/server";
import { parseClassification } from "@/lib/literature-forest/model";
import { forestFailure, forestJson } from "@/lib/literature-forest/http";

type Context = { params: Promise<{ bookId: string }> };
export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id)
    return forestJson({ error: "ログインが必要です" }, 401);
  try {
    return forestJson({
      tree: await getForestEntry(
        session.user.id,
        (await context.params).bookId,
      ),
    });
  } catch (error) {
    return forestFailure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  const user = await requireActiveUser();
  if (!user.ok) return forestJson({ error: user.error }, user.status);
  let classification;
  try {
    classification = parseClassification(await request.json());
  } catch (error) {
    return forestJson(
      {
        error:
          error instanceof Error ? error.message : "入力を確認してください",
      },
      400,
    );
  }
  try {
    return forestJson({
      tree: await saveClassification(
        user.userId,
        (await context.params).bookId,
        classification,
      ),
    });
  } catch (error) {
    return forestFailure(error);
  }
}
