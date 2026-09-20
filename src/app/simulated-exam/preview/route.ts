import { isValidDraftId, readDraftPdf } from "@/lib/drafts";

export const dynamic = "force-dynamic";

/** 預覽尚未儲存的草稿 PDF：GET /simulated-exam/preview?id=<草稿 id>&kind=exam|answer */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const kind = params.get("kind");
  if (!isValidDraftId(id) || (kind !== "exam" && kind !== "answer")) {
    return Response.json({ error: "參數無效" }, { status: 400 });
  }
  try {
    const pdf = await readDraftPdf(id, kind);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "找不到草稿，可能已過期，請重新生成" }, { status: 404 });
  }
}
