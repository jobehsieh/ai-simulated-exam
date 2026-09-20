// 瀏覽器端儲存：雲端伺服器不能寫入使用者的硬碟，所以改由瀏覽器寫檔。
// 使用 File System Access API（Chrome / Edge）：使用者選一次「模擬考題」資料夾，
// 之後在裡面自動依科目建子資料夾並寫入 PDF。資料夾授權存在 IndexedDB，下次開啟仍可沿用。
// 不支援的瀏覽器（Firefox / Safari）退回一般的檔案下載。

interface PermissionMethods {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
}
type DirHandle = FileSystemDirectoryHandle & PermissionMethods;
type DirectoryPicker = (options?: { id?: string; mode?: "readwrite" }) => Promise<FileSystemDirectoryHandle>;

const DB_NAME = "ai-simulated-exam";
const STORE = "handles";
const HANDLE_KEY = "output-dir";

export function isFolderSaveSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbRun<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function getStoredHandle(): Promise<DirHandle | null> {
  try {
    return ((await dbRun("readonly", (s) => s.get(HANDLE_KEY))) as DirHandle | undefined) ?? null;
  } catch {
    return null; // 無痕模式等情況 IndexedDB 可能不可用
  }
}

/** 目前記住的儲存資料夾名稱；還沒選過（或不支援）回傳 null */
export async function getSavedFolderName(): Promise<string | null> {
  if (!isFolderSaveSupported()) return null;
  return (await getStoredHandle())?.name ?? null;
}

export async function forgetSavedFolder(): Promise<void> {
  try {
    await dbRun("readwrite", (s) => s.delete(HANDLE_KEY));
  } catch {
    // 沒有東西可忘記
  }
}

/** 跳出資料夾選擇視窗（必須在使用者點擊等操作中呼叫），並盡力記住選擇 */
async function pickFolder(): Promise<DirHandle> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
  const handle = (await picker.call(window, { id: "exam-output", mode: "readwrite" })) as DirHandle;
  try {
    await dbRun("readwrite", (s) => s.put(handle, HANDLE_KEY));
  } catch {
    // 記不住（例如無痕視窗）只代表下次要重新選擇，不影響這次儲存
  }
  return handle;
}

export async function chooseSaveFolder(): Promise<string> {
  return (await pickFolder()).name;
}

async function ensureWritable(handle: DirHandle): Promise<void> {
  const options = { mode: "readwrite" as const };
  if ((await handle.queryPermission(options)) === "granted") return;
  if ((await handle.requestPermission(options)) !== "granted") throw new Error("沒有取得資料夾的寫入權限");
}

async function fileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return false;
    throw error;
  }
}

export interface SaveFile {
  /** 檔名結尾，例如 ".pdf"、"_解答卷.pdf"；同名檔案已存在時流水號會插在它前面 */
  tail: string;
  blob: Blob;
}

export type SaveResult = { mode: "folder"; folderName: string; paths: string[] } | { mode: "download"; paths: string[] };

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * 儲存一組 PDF：`{資料夾}/{科目}/{base}[_n]{tail}`。同名檔案已存在時加流水號，不覆蓋舊檔。
 * 尚未選過資料夾時會先跳出選擇視窗，所以必須在使用者點擊時呼叫。
 */
export async function savePdfs(subjectName: string, base: string, files: SaveFile[]): Promise<SaveResult> {
  if (!isFolderSaveSupported()) {
    const paths = files.map((f) => `${base}${f.tail}`);
    files.forEach((f, i) => download(f.blob, paths[i]));
    return { mode: "download", paths };
  }

  // 已記住的資料夾優先；否則請使用者選，並直接使用剛選到的控制代碼（不必等它存進 IndexedDB）
  const handle = (await getStoredHandle()) ?? (await pickFolder());
  await ensureWritable(handle);

  const subjectDir = await handle.getDirectoryHandle(subjectName, { create: true });
  let names: string[] = [];
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? "" : `_${n}`;
    names = files.map((f) => `${base}${suffix}${f.tail}`);
    const taken = await Promise.all(names.map((name) => fileExists(subjectDir, name)));
    if (!taken.some(Boolean)) break;
  }

  for (const [i, file] of files.entries()) {
    const writable = await (await subjectDir.getFileHandle(names[i], { create: true })).createWritable();
    await writable.write(file.blob);
    await writable.close();
  }
  return { mode: "folder", folderName: handle.name, paths: names.map((name) => `${handle.name}/${subjectName}/${name}`) };
}
