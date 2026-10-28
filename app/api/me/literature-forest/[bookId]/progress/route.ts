import { requireActiveUser } from "@/lib/active-user";
import { changeForestPage } from "@/lib/literature-forest/server";
import { forestFailure, forestJson } from "@/lib/literature-forest/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const user = await requireActiveUser();
  if (!user.ok) return forestJson({ error: user.error }, user.status);
  let input;
  try {
    input = await request.json();
  } catch {
    return forestJson({ error: "入力を確認してください" }, 400);
  }
  try {
    return forestJson({
      tree: await changeForestPage(
        user.userId,
        (await context.params).bookId,
        input,
      ),
    });
  } catch (error) {
    return forestFailure(error);
  }
}
