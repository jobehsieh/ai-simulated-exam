import { isValidDraftId, saveDraft } from "@/lib/drafts";

export const dynamic = "force-dynamic";

/** 使用者確認無誤後，把草稿下載（存檔）到「模擬考題\{科目}\」：POST { id } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = body?.id;
  if (!isValidDraftId(typeof id === "string" ? id : null)) {
    return Response.json({ error: "草稿 id 無效" }, { status: 400 });
  }
  try {
    const saved = await saveDraft(id as string);
    return Response.json(saved);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "儲存失敗" }, { status: 500 });
  }
}
