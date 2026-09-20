"use client";

import { useSyncExternalStore } from "react";
import { API_KEY_HEADER, validateKeyFormat } from "./api-key-shared";

// BYOK 的瀏覽器端：金鑰只存在這個瀏覽器的 localStorage，不會存到伺服器。
const STORAGE_KEY = "ai-simulated-exam:opencode-api-key";
const CHANGE_EVENT = "api-key-change";
const OPEN_DIALOG_EVENT = "open-api-key-dialog";

export function readStoredApiKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // 無痕模式或被封鎖時可能拋錯
  }
}

/** 儲存前會去除前後空白並檢查格式；失敗時丟出可直接顯示的錯誤訊息 */
export function saveApiKey(raw: string): string {
  const key = raw.trim();
  const problem = validateKeyFormat(key);
  if (problem) throw new Error(problem);
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    throw new Error("瀏覽器不允許儲存資料（可能是無痕模式或封鎖了網站資料），金鑰無法保存");
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return key;
}

export function clearApiKey(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無法存取時沒有東西可清
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange); // 其他分頁修改時同步
  window.addEventListener(CHANGE_EVENT, onChange); // 同一分頁修改時同步
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 目前儲存的金鑰：字串＝已設定、null＝未設定、undefined＝尚未讀取（伺服器渲染與水合期間） */
export function useApiKey(): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(subscribe, readStoredApiKey, () => undefined);
}

/** 打本站 API 時附上金鑰的 header */
export function apiKeyHeaders(key: string): Record<string, string> {
  return { [API_KEY_HEADER]: key };
}

export function openApiKeyDialog(): void {
  window.dispatchEvent(new Event(OPEN_DIALOG_EVENT));
}

export function onOpenApiKeyDialog(handler: () => void): () => void {
  window.addEventListener(OPEN_DIALOG_EVENT, handler);
  return () => window.removeEventListener(OPEN_DIALOG_EVENT, handler);
}
