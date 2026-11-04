// A short-lived copy of files being handed from one page to the next, kept in the
// browser's own storage (IndexedDB, on this device only). The in-memory hand-off in
// pending-document.ts is lost when the next page loads in full, for example after the
// site is updated or the page is refreshed; this copy lets that page still open the files.
// Copies are deleted as soon as they're read, and ignored once they're a few minutes old.
// Storage can be unavailable (private browsing, blocked site data): every call then quietly
// does nothing, and the page asks for the file again as before.

const DB = "editbee-handoff";
const STORE = "files";
const MAX_AGE_MS = 10 * 60 * 1000;

export type HandoffKey = "editor" | "extract" | `tool:${string}`;

type Entry = { files: File[]; saved: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Keeps a copy of the files for the next page. Waits at most a moment, so navigation isn't held up. */
export async function saveHandoff(key: HandoffKey, files: File[]) {
  try {
    const save = run("readwrite", (s) => {
      // Only one hand-off is ever needed, so older copies (e.g. from a closed tab) go first.
      s.clear();
      return s.put({ files, saved: Date.now() } satisfies Entry, key);
    });
    await Promise.race([save, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // No storage: the in-memory hand-off still works for normal navigation.
  }
}

// Reads made within a moment of each other share one result, so a page whose start-up code
// runs twice (React does this in development) neither loses the files nor gets them twice.
const recent = new Map<HandoffKey, Promise<File[] | null>>();
const SHARE_MS = 3000;

function remember(key: HandoffKey, result: Promise<File[] | null>) {
  recent.set(key, result);
  setTimeout(() => recent.get(key) === result && recent.delete(key), SHARE_MS);
  return result;
}

async function readAndDelete(key: HandoffKey): Promise<File[] | null> {
  try {
    const entry = await run<Entry | undefined>("readonly", (s) => s.get(key));
    if (entry) await run("readwrite", (s) => s.delete(key));
    if (!entry || Date.now() - entry.saved > MAX_AGE_MS || !entry.files?.length) return null;
    return entry.files;
  } catch {
    return null;
  }
}

/** Returns the saved files once (deleting the copy), or null if there are none or they're too old. */
export function takeHandoff(key: HandoffKey): Promise<File[] | null> {
  return recent.get(key) ?? remember(key, readAndDelete(key));
}

/** Deletes a saved copy, e.g. once the files arrived through the in-memory hand-off. */
export async function discardHandoff(key: HandoffKey) {
  // Reads straight after this find nothing, even before the delete finishes.
  remember(key, Promise.resolve(null));
  try {
    await run("readwrite", (s) => s.delete(key));
  } catch {
    // Nothing to delete, or no storage.
  }
}
