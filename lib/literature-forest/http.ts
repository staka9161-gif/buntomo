import { NextResponse } from "next/server";
import { ForestError } from "./server";

export function forestJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function forestFailure(error: unknown) {
  if (error instanceof ForestError)
    return forestJson({ error: error.message }, error.status);
  console.error("Literature forest request failed", error);
  return forestJson(
    {
      error:
        "読書の森を読み込み・保存できませんでした。時間をおいて再試行してください",
    },
    500,
  );
}
