"use client";

import { openApiKeyDialog, useApiKey } from "@/lib/api-key-client";

/** Header 上的金鑰狀態按鈕：已設定顯示綠點，未設定顯示紅點；點擊開啟設定視窗 */
export default function ApiKeyButton() {
  const key = useApiKey();
  const configured = typeof key === "string";

  return (
    <button
      type="button"
      onClick={openApiKeyDialog}
      title={configured ? "API 金鑰已設定，點擊可更換或清除" : "設定 API 金鑰"}
      className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${
          key === undefined ? "bg-ink/25" : configured ? "bg-emerald-600" : "animate-pulse bg-vermilion"
        }`}
      />
      <span className="hidden sm:inline">API 金鑰</span>
      <span className="sm:hidden">金鑰</span>
      {key !== undefined && <span className="sr-only">{configured ? "（已設定）" : "（未設定）"}</span>}
    </button>
  );
}
