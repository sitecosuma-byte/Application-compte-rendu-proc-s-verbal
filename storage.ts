/**
 * Stockage local sécurisé (hors-ligne) :
 *  - IndexedDB  : séances (infos, transcription, PV), enregistrements audio (Blob), logo.
 *  - localStorage : préférences légères (moteur IA, langue, clés facultatives).
 *
 * Aucune donnée ne quitte l'appareil, sauf lors d'un appel explicite à une API IA.
 */
import {
  AppSettings,
  DEFAULT_ORG,
  DEFAULT_SETTINGS,
  MeetingSession,
  OrgSettings,
} from "./types";

const DB_NAME = "cosuma-pv";
const DB_VERSION = 1;
const STORE_SESSIONS = "sessions";
const STORE_AUDIO = "audio";
const STORE_KV = "kv";

export interface AudioRecord {
  id: string;
  sessionId: string;
  createdAt: number;
  mimeType: string;
  durationMs: number;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible sur ce navigateur."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        const s = db.createObjectStore(STORE_AUDIO, { keyPath: "id" });
        s.createIndex("sessionId", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Exécute une requête IndexedDB et renvoie son résultat sous forme de promesse. */
async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ------------------------------ Séances ------------------------------ */

export async function listSessions(): Promise<MeetingSession[]> {
  const all = await run<MeetingSession[]>(STORE_SESSIONS, "readonly", (s) => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveSession(session: MeetingSession): Promise<IDBValidKey> {
  return run(STORE_SESSIONS, "readwrite", (s) => s.put(session));
}

export async function deleteSession(id: string): Promise<void> {
  const audios = await listAudio(id);
  for (const a of audios) await deleteAudio(a.id);
  await run(STORE_SESSIONS, "readwrite", (s) => s.delete(id));
}

/* ------------------------------ Audio ------------------------------ */

export function saveAudio(rec: AudioRecord): Promise<IDBValidKey> {
  return run(STORE_AUDIO, "readwrite", (s) => s.put(rec));
}

export function listAudio(sessionId: string): Promise<AudioRecord[]> {
  return run<AudioRecord[]>(STORE_AUDIO, "readonly", (s) =>
    s.index("sessionId").getAll(IDBKeyRange.only(sessionId)),
  );
}

export function deleteAudio(id: string): Promise<undefined> {
  return run(STORE_AUDIO, "readwrite", (s) => s.delete(id));
}

/* ------------------------------ Clé / valeur ------------------------------ */

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>(STORE_KV, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export function kvSet<T>(key: string, value: T): Promise<IDBValidKey> {
  return run(STORE_KV, "readwrite", (s) => s.put(value, key));
}

export async function loadOrgSettings(): Promise<OrgSettings> {
  try {
    const v = await kvGet<OrgSettings>("org");
    return { ...DEFAULT_ORG, ...(v ?? {}) };
  } catch {
    return DEFAULT_ORG;
  }
}

export function saveOrgSettings(org: OrgSettings) {
  return kvSet("org", org);
}

/* ------------------------------ Préférences (localStorage) ------------------------------ */

const SETTINGS_KEY = "cosuma-pv:settings";

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keys: { ...DEFAULT_SETTINGS.keys, ...(parsed.keys ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible (navigation privée) : on ignore */
  }
}

/** Demande au navigateur de ne pas purger les données (meilleure protection avant export). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
