"use client";

import { useEffect, useRef, useState } from "react";
import {
  apiKeyHeaders,
  clearApiKey,
  onOpenApiKeyDialog,
  saveApiKey,
  useApiKey,
} from "@/lib/api-key-client";
import { maskKey, validateKeyFormat } from "@/lib/api-key-shared";

type Notice = { tone: "ok" | "error" | "info"; text: string } | null;

const NOTICE_STYLE = {
  ok: "bg-emerald-700/10 text-emerald-900",
  error: "bg-vermilion/10 text-vermilion",
  info: "bg-ink/5 text-ink-soft",
} as const;

/** BYOK 設定視窗：使用者貼上自己的 OpenCode API key，存於瀏覽器 localStorage */
export default function ApiKeyDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const saved = useApiKey();
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(
    () =>
      onOpenApiKeyDialog(() => {
        setDraft("");
        setReveal(false);
        setNotice(null);
        dialogRef.current?.showModal();
      }),
    [],
  );

  const close = () => dialogRef.current?.close();

  function handleSave() {
    try {
      saveApiKey(draft);
      setDraft("");
      setNotice({ tone: "ok", text: "已儲存到這個瀏覽器。可以按「驗證連線」確認金鑰有效。" });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleVerify() {
    // 優先驗證輸入框裡的內容（尚未儲存也可以先驗證），沒有輸入就驗證已儲存的
    const candidate = draft.trim() || saved || "";
    const problem = validateKeyFormat(candidate);
    if (problem) {
      setNotice({ tone: "error", text: problem });
      return;
    }
    setBusy(true);
    setNotice({ tone: "info", text: "驗證中…" });
    try {
      const res = await fetch("/simulated-exam/verify", { method: "POST", headers: apiKeyHeaders(candidate) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setNotice({
          tone: "ok",
          text: draft.trim() ? "金鑰有效。記得按「儲存」才會保存。" : "金鑰有效，可以開始出題。",
        });
      } else {
        setNotice({ tone: "error", text: data.error ?? `驗證失敗（HTTP ${res.status}）` });
      }
    } catch {
      setNotice({ tone: "error", text: "無法連線到本站 API，請確認伺服器仍在執行" });
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    clearApiKey();
    setDraft("");
    setNotice({ tone: "info", text: "已從這個瀏覽器清除金鑰。" });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="api-key-title"
      className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-ink/20 bg-sheet p-0 text-ink shadow-[0_30px_80px_-20px_rgb(28_26_22/0.6)] backdrop:bg-ink/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg italic text-vermilion">Bring your own key</p>
            <h2 id="api-key-title" className="mt-1 font-serif text-2xl font-black">
              設定 OpenCode API 金鑰
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="關閉"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/20 text-lg leading-none transition-colors hover:bg-ink hover:text-paper"
          >
            ×
          </button>
        </div>

        <ul className="mt-5 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>
            • 出題使用<b className="text-ink">你自己的</b> OpenCode Go 金鑰，費用計入你的帳戶。
          </li>
          <li>
            • 金鑰只存在<b className="text-ink">這個瀏覽器</b>的 localStorage；出題時經由請求 header 傳給本站 API 轉發，
            伺服器不會儲存或記錄。
          </li>
          <li>• 共用電腦請在用完後按「清除」。</li>
        </ul>

        <div className="mt-6">
          <p className="text-sm">
            目前狀態：
            {saved ? (
              <span className="font-mono text-emerald-800">已設定（{maskKey(saved)}）</span>
            ) : (
              <span className="text-vermilion">尚未設定</span>
            )}
          </p>

          <label htmlFor="api-key-input" className="mt-4 block text-sm font-medium">
            {saved ? "更換金鑰" : "貼上金鑰"}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="api-key-input"
              type={reveal ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) handleSave();
              }}
              placeholder="你的 OpenCode Go API key"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-ink/25 bg-white px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-vermilion focus:ring-2 focus:ring-vermilion/25"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="shrink-0 rounded-lg border border-ink/25 px-3 text-sm transition-colors hover:bg-ink hover:text-paper"
            >
              {reveal ? "隱藏" : "顯示"}
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm leading-relaxed ${NOTICE_STYLE[notice.tone]}`}>
            {notice.text}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.trim() || busy}
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-paper transition-colors enabled:hover:bg-vermilion disabled:cursor-not-allowed disabled:opacity-40"
          >
            儲存
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={busy || (!draft.trim() && !saved)}
            className="rounded-full border border-ink/30 px-5 py-2.5 text-sm font-medium transition-colors enabled:hover:border-ink enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            驗證連線
          </button>
          {saved && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full px-4 py-2.5 text-sm text-vermilion underline decoration-vermilion/40 underline-offset-4 hover:decoration-vermilion"
            >
              清除金鑰
            </button>
          )}
        </div>

        <p className="mt-6 border-t border-ink/15 pt-4 text-xs leading-relaxed text-ink-soft">
          還沒有金鑰？請參考{" "}
          <a
            href="https://opencode.ai/docs/go/"
            target="_blank"
            rel="noreferrer"
            className="text-ink underline underline-offset-4 hover:text-vermilion"
          >
            OpenCode Go 文件 ↗
          </a>{" "}
          訂閱並取得 API 金鑰。
        </p>
      </div>
    </dialog>
  );
}
